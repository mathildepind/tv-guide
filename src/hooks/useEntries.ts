import { useCallback, useEffect, useState } from 'react';
import {
  addEntry as dbAddEntry,
  addSeasonProgress as dbAddSeasonProgress,
  getEntries,
  getEntry,
  removeEntry as dbRemoveEntry,
  getSeasonsForEntry,
  updateEntry as dbUpdateEntry,
  updateSeasonProgress as dbUpdateSeasonProgress,
} from '../db/database';
import type { Entry, MediaType, SeasonProgress, WatchStatus } from '../types';

// ─── All entries ──────────────────────────────────────────────────────────────

interface UseEntriesResult {
  entries: Entry[];
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  addEntry: (entry: Omit<Entry, 'id'>) => Promise<Entry>;
  updateEntry: (
    id: number,
    fields: Partial<Pick<Entry, 'status' | 'rating' | 'notes' | 'watched_at'>>,
  ) => Promise<void>;
  removeEntry: (id: number) => Promise<void>;
}

/**
 * Hook that provides CRUD access to entries and auto-refreshes the list.
 * Optionally filter by watch status.
 */
export function useEntries(status?: WatchStatus): UseEntriesResult {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getEntries(status);
      setEntries(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [status]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addEntry = useCallback(
    async (entry: Omit<Entry, 'id'>): Promise<Entry> => {
      const created = await dbAddEntry(entry);
      await refresh();
      return created;
    },
    [refresh],
  );

  const updateEntry = useCallback(
    async (
      id: number,
      fields: Partial<Pick<Entry, 'status' | 'rating' | 'notes' | 'watched_at'>>,
    ): Promise<void> => {
      await dbUpdateEntry(id, fields);
      await refresh();
    },
    [refresh],
  );

  const removeEntry = useCallback(
    async (id: number): Promise<void> => {
      await dbRemoveEntry(id);
      await refresh();
    },
    [refresh],
  );

  return {
    entries,
    isLoading,
    error,
    refresh,
    addEntry,
    updateEntry,
    removeEntry,
  };
}

// ─── Single entry (by TMDB id) ────────────────────────────────────────────────

interface UseEntryResult {
  entry: Entry | null;
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

/** Fetch (and keep in sync) a single entry by RT emsId and media type. */
export function useEntry(
  emsId: string,
  mediaType: MediaType,
): UseEntryResult {
  const [entry, setEntry] = useState<Entry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getEntry(emsId, mediaType);
      setEntry(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [emsId, mediaType]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { entry, isLoading, error, refresh };
}

// ─── Season progress ──────────────────────────────────────────────────────────

interface UseSeasonProgressResult {
  seasons: SeasonProgress[];
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  upsertSeason: (progress: Omit<SeasonProgress, 'id'>) => Promise<void>;
  updateSeason: (
    id: number,
    fields: Partial<Pick<SeasonProgress, 'watched' | 'rating' | 'notes'>>,
  ) => Promise<void>;
}

/** Hook for per-season progress of a given entry. */
export function useSeasonProgress(entryId: number): UseSeasonProgressResult {
  const [seasons, setSeasons] = useState<SeasonProgress[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (!entryId) return;
    setIsLoading(true);
    try {
      const data = await getSeasonsForEntry(entryId);
      setSeasons(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [entryId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const upsertSeason = useCallback(
    async (progress: Omit<SeasonProgress, 'id'>): Promise<void> => {
      await dbAddSeasonProgress(progress);
      await refresh();
    },
    [refresh],
  );

  const updateSeason = useCallback(
    async (
      id: number,
      fields: Partial<Pick<SeasonProgress, 'watched' | 'rating' | 'notes'>>,
    ): Promise<void> => {
      await dbUpdateSeasonProgress(id, fields);
      await refresh();
    },
    [refresh],
  );

  return {
    seasons,
    isLoading,
    error,
    refresh,
    upsertSeason,
    updateSeason,
  };
}
