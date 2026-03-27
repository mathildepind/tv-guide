import * as SQLite from 'expo-sqlite';
import { ALL_CREATE_STATEMENTS } from './schema';
import type { Entry, SeasonProgress, WatchStatus } from '../types';

// ─── DB singleton ────────────────────────────────────────────────────────────

let _db: SQLite.SQLiteDatabase | null = null;

export function getDb(): SQLite.SQLiteDatabase {
  if (!_db) {
    throw new Error('Database not initialised. Call initDatabase() first.');
  }
  return _db;
}

// ─── Init ────────────────────────────────────────────────────────────────────

/**
 * Opens (or creates) the SQLite database and creates all tables.
 * Must be awaited before any other DB call.
 */
export async function initDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (_db) return _db;

  const db = await SQLite.openDatabaseAsync('tvguide.db');

  // Enable WAL mode for better concurrent performance and enforce FK constraints.
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await db.execAsync('PRAGMA foreign_keys = ON;');

  for (const statement of ALL_CREATE_STATEMENTS) {
    await db.execAsync(statement);
  }

  await runMigrations(db);

  _db = db;
  return db;
}

/**
 * Runs incremental schema migrations keyed by `PRAGMA user_version`.
 * Each migration bracket is idempotent — safe to run on a fresh DB too.
 */
async function runMigrations(db: SQLite.SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const version = row?.user_version ?? 0;

  if (version < 1) {
    // v1 — add 'watching' to the status CHECK constraint.
    // SQLite doesn't support ALTER COLUMN, so we recreate the table.
    const tableExists = await db.getFirstAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='entries'",
    );
    if (tableExists) {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS entries_v1 (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          ems_id      TEXT    NOT NULL,
          media_type  TEXT    NOT NULL CHECK(media_type IN ('movie', 'tv')),
          title       TEXT    NOT NULL,
          poster_path TEXT,
          overview    TEXT    NOT NULL DEFAULT '',
          status      TEXT    NOT NULL CHECK(status IN ('want_to_watch', 'watching', 'watched')),
          rating      INTEGER CHECK(rating IS NULL OR (rating >= 1 AND rating <= 5)),
          notes       TEXT,
          added_at    TEXT    NOT NULL,
          watched_at  TEXT,
          UNIQUE(ems_id, media_type)
        );
        INSERT INTO entries_v1 SELECT * FROM entries;
        DROP TABLE entries;
        ALTER TABLE entries_v1 RENAME TO entries;
      `);
    }
    await db.execAsync('PRAGMA user_version = 1');
  }
}

// ─── Entries ─────────────────────────────────────────────────────────────────

/** Add a new entry. Throws if the (ems_id, media_type) pair already exists. */
export async function addEntry(
  entry: Omit<Entry, 'id'>,
): Promise<Entry> {
  const db = getDb();
  const result = await db.runAsync(
    `INSERT INTO entries
       (ems_id, media_type, title, poster_path, overview, status, rating, notes, added_at, watched_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.ems_id,
      entry.media_type,
      entry.title,
      entry.poster_path ?? null,
      entry.overview,
      entry.status,
      entry.rating ?? null,
      entry.notes ?? null,
      entry.added_at,
      entry.watched_at ?? null,
    ],
  );
  return { ...entry, id: result.lastInsertRowId };
}

/** Update mutable fields on an existing entry. */
export async function updateEntry(
  id: number,
  fields: Partial<Pick<Entry, 'status' | 'rating' | 'notes' | 'watched_at'>>,
): Promise<void> {
  const db = getDb();
  const updates: string[] = [];
  const values: (string | number | null)[] = [];

  if (fields.status !== undefined) {
    updates.push('status = ?');
    values.push(fields.status);
  }
  if (fields.rating !== undefined) {
    updates.push('rating = ?');
    values.push(fields.rating ?? null);
  }
  if (fields.notes !== undefined) {
    updates.push('notes = ?');
    values.push(fields.notes ?? null);
  }
  if (fields.watched_at !== undefined) {
    updates.push('watched_at = ?');
    values.push(fields.watched_at ?? null);
  }

  if (updates.length === 0) return;

  values.push(id);
  await db.runAsync(
    `UPDATE entries SET ${updates.join(', ')} WHERE id = ?`,
    values,
  );
}

/** Permanently delete an entry and all its season/episode progress (CASCADE). */
export async function removeEntry(id: number): Promise<void> {
  const db = getDb();
  await db.runAsync('DELETE FROM entries WHERE id = ?', [id]);
}

/** Fetch all entries, optionally filtered by watch status. */
export async function getEntries(status?: WatchStatus): Promise<Entry[]> {
  const db = getDb();
  const rows = status
    ? await db.getAllAsync<EntryRow>(
        'SELECT * FROM entries WHERE status = ? ORDER BY added_at DESC',
        [status],
      )
    : await db.getAllAsync<EntryRow>(
        'SELECT * FROM entries ORDER BY added_at DESC',
      );
  return rows.map(rowToEntry);
}

/** Look up a single entry by its RT emsId and media type. Returns null if not found. */
export async function getEntry(
  emsId: string,
  mediaType: Entry['media_type'],
): Promise<Entry | null> {
  const db = getDb();
  const row = await db.getFirstAsync<EntryRow>(
    'SELECT * FROM entries WHERE ems_id = ? AND media_type = ?',
    [emsId, mediaType],
  );
  return row ? rowToEntry(row) : null;
}

// ─── Season progress ─────────────────────────────────────────────────────────

/**
 * Upsert a season progress record.
 * Creates the row if it does not exist; updates `watched`, `rating`, `notes` otherwise.
 */
export async function addSeasonProgress(
  progress: Omit<SeasonProgress, 'id'>,
): Promise<SeasonProgress> {
  const db = getDb();
  const result = await db.runAsync(
    `INSERT INTO season_progress (entry_id, season_number, watched, rating, notes)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(entry_id, season_number) DO UPDATE SET
       watched = excluded.watched,
       rating  = excluded.rating,
       notes   = excluded.notes`,
    [
      progress.entry_id,
      progress.season_number,
      progress.watched ? 1 : 0,
      progress.rating ?? null,
      progress.notes ?? null,
    ],
  );

  // After upsert, fetch the actual row to return the correct id.
  const row = await db.getFirstAsync<SeasonProgressRow>(
    'SELECT * FROM season_progress WHERE entry_id = ? AND season_number = ?',
    [progress.entry_id, progress.season_number],
  );
  if (!row) throw new Error('Failed to upsert season progress');
  return rowToSeasonProgress(row);
}

/** Update watched/rating/notes on an existing season progress row. */
export async function updateSeasonProgress(
  id: number,
  fields: Partial<Pick<SeasonProgress, 'watched' | 'rating' | 'notes'>>,
): Promise<void> {
  const db = getDb();
  const updates: string[] = [];
  const values: (string | number | null)[] = [];

  if (fields.watched !== undefined) {
    updates.push('watched = ?');
    values.push(fields.watched ? 1 : 0);
  }
  if (fields.rating !== undefined) {
    updates.push('rating = ?');
    values.push(fields.rating ?? null);
  }
  if (fields.notes !== undefined) {
    updates.push('notes = ?');
    values.push(fields.notes ?? null);
  }

  if (updates.length === 0) return;

  values.push(id);
  await db.runAsync(
    `UPDATE season_progress SET ${updates.join(', ')} WHERE id = ?`,
    values,
  );
}

/** Fetch all season progress rows for a given entry, ordered by season number. */
export async function getSeasonsForEntry(
  entryId: number,
): Promise<SeasonProgress[]> {
  const db = getDb();
  const rows = await db.getAllAsync<SeasonProgressRow>(
    'SELECT * FROM season_progress WHERE entry_id = ? ORDER BY season_number ASC',
    [entryId],
  );
  return rows.map(rowToSeasonProgress);
}

// ─── Row → type helpers ───────────────────────────────────────────────────────

interface EntryRow {
  id: number;
  ems_id: string;
  media_type: string;
  title: string;
  poster_path: string | null;
  overview: string;
  status: string;
  rating: number | null;
  notes: string | null;
  added_at: string;
  watched_at: string | null;
}

function rowToEntry(row: EntryRow): Entry {
  return {
    id: row.id,
    ems_id: row.ems_id,
    media_type: row.media_type as Entry['media_type'],
    title: row.title,
    poster_path: row.poster_path,
    overview: row.overview,
    status: row.status as WatchStatus,
    rating: row.rating,
    notes: row.notes,
    added_at: row.added_at,
    watched_at: row.watched_at,
  };
}

interface SeasonProgressRow {
  id: number;
  entry_id: number;
  season_number: number;
  watched: number; // SQLite stores booleans as 0/1
  rating: number | null;
  notes: string | null;
}

function rowToSeasonProgress(row: SeasonProgressRow): SeasonProgress {
  return {
    id: row.id,
    entry_id: row.entry_id,
    season_number: row.season_number,
    watched: row.watched === 1,
    rating: row.rating,
    notes: row.notes,
  };
}
