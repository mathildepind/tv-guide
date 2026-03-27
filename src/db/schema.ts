/**
 * SQLite schema definitions.
 *
 * v1 supports per-season tracking via `season_progress`.
 * The `episode_progress` table is scaffolded for future per-episode tracking
 * and is referenced by a foreign key on `season_progress_id`.
 */

export const CREATE_ENTRIES_TABLE = `
  CREATE TABLE IF NOT EXISTS entries (
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
`;

export const CREATE_SEASON_PROGRESS_TABLE = `
  CREATE TABLE IF NOT EXISTS season_progress (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    entry_id      INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
    season_number INTEGER NOT NULL,
    watched       INTEGER NOT NULL DEFAULT 0 CHECK(watched IN (0, 1)),
    rating        INTEGER CHECK(rating IS NULL OR (rating >= 1 AND rating <= 5)),
    notes         TEXT,
    UNIQUE(entry_id, season_number)
  );
`;

export const CREATE_EPISODE_PROGRESS_TABLE = `
  CREATE TABLE IF NOT EXISTS episode_progress (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    season_progress_id INTEGER NOT NULL REFERENCES season_progress(id) ON DELETE CASCADE,
    entry_id           INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
    season_number      INTEGER NOT NULL,
    episode_number     INTEGER NOT NULL,
    watched            INTEGER NOT NULL DEFAULT 0 CHECK(watched IN (0, 1)),
    rating             INTEGER CHECK(rating IS NULL OR (rating >= 1 AND rating <= 5)),
    notes              TEXT,
    UNIQUE(entry_id, season_number, episode_number)
  );
`;

/** Run all CREATE TABLE statements in order. */
export const ALL_CREATE_STATEMENTS = [
  CREATE_ENTRIES_TABLE,
  CREATE_SEASON_PROGRESS_TABLE,
  CREATE_EPISODE_PROGRESS_TABLE,
];
