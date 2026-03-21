import { useEffect, useState } from 'react';
import type { SQLiteDatabase } from 'expo-sqlite';
import { initDatabase } from '../db/database';

interface UseDatabaseResult {
  db: SQLiteDatabase | null;
  isReady: boolean;
  error: Error | null;
}

/**
 * Initialises the SQLite database once and exposes its ready state.
 * All screens that need DB access should wait until `isReady` is true.
 */
export function useDatabase(): UseDatabaseResult {
  const [db, setDb] = useState<SQLiteDatabase | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const database = await initDatabase();
        if (!cancelled) {
          setDb(database);
          setIsReady(true);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      }
    }

    init();

    return () => {
      cancelled = true;
    };
  }, []);

  return { db, isReady, error };
}
