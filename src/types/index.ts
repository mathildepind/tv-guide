// ─── Media types ─────────────────────────────────────────────────────────────

export type MediaType = 'movie' | 'tv';

export type WatchStatus = 'want_to_watch' | 'watching' | 'watched';

// ─── Rotten Tomatoes API types ────────────────────────────────────────────────

export interface RTSearchResult {
  emsId: string;
  type: MediaType;
  title: string;
  description: string;
  releaseYear: number;
  posterImageUrl: string | null;
  rottenTomatoes?: {
    criticsScore?: number;
    audienceScore?: number;
    certifiedFresh?: boolean;
  };
  genres: string[];
  runTime?: number;
}

export interface RTMovieDetails {
  emsMovieId: string;
  title: string;
  description: string;
  posterUri: string | null;
  primaryImageUrl: string | null;
  releaseYear: string;
  runTimeInMinutes: number;
  genres: string[];
  tomatometerScore?: {
    score: string;
    consensus?: string;
    certified: boolean;
  };
  audienceScore?: {
    score: string;
  };
}

export interface RTTVSeason {
  season_number: number;
  name: string;
  episode_count: number;
}

export interface RTTVDetails {
  emsId: string;
  title: string;
  description: string;
  posterUri: string | null;
  primaryImageUrl: string | null;
  releaseYear: string;
  genres: string[];
  tomatometerScore?: {
    score: string;
    consensus?: string;
    certified: boolean;
  };
  audienceScore?: {
    score: string;
  };
  seasons?: RTTVSeason[];
}

// ─── Local DB types ──────────────────────────────────────────────────────────

export interface Entry {
  /** Local SQLite row ID */
  id: number;
  /** Rotten Tomatoes emsId (UUID string) */
  ems_id: string;
  media_type: MediaType;
  title: string;
  poster_path: string | null;
  overview: string;
  status: WatchStatus;
  /** 1–5 stars; null until rated */
  rating: number | null;
  notes: string | null;
  added_at: string; // ISO-8601
  watched_at: string | null; // ISO-8601
}

export interface SeasonProgress {
  id: number;
  entry_id: number;
  season_number: number;
  watched: boolean;
  rating: number | null;
  notes: string | null;
}

export interface EpisodeProgress {
  id: number;
  season_progress_id: number;
  entry_id: number;
  season_number: number;
  episode_number: number;
  watched: boolean;
  rating: number | null;
  notes: string | null;
}

// ─── Navigation param list types ─────────────────────────────────────────────

export type RootStackParamList = {
  MainTabs: undefined;
  Detail: { emsId: string; mediaType: MediaType };
};

export type SearchStackParamList = {
  Search: undefined;
  Detail: { emsId: string; mediaType: MediaType };
};

export type MyListsStackParamList = {
  MyLists: undefined;
  Detail: { emsId: string; mediaType: MediaType };
};
