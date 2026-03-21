import { RT_API_KEY, RT_API_HOST, RT_BASE_URL } from '../constants/api';
import type { RTMovieDetails, RTSearchResult, RTTVDetails } from '../types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const RT_HEADERS = {
  'x-rapidapi-key': RT_API_KEY ?? '',
  'x-rapidapi-host': RT_API_HOST,
  'Content-Type': 'application/json',
};

async function rtFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${RT_BASE_URL}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: RT_HEADERS,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`RT API error ${response.status} for ${path}: ${text}`);
  }

  return response.json() as Promise<T>;
}

// ─── Search ──────────────────────────────────────────────────────────────────

interface RTSearchResponse {
  results: Array<{
    hits: RawSearchHit[];
    nbHits: number;
    page: number;
    nbPages: number;
  }>;
}

interface RawSearchHit {
  emsId: string;
  type: string;
  title: string;
  description: string;
  releaseYear: number;
  posterImageUrl: string | null;
  rottenTomatoes?: {
    criticsScore?: number;
    audienceScore?: number;
    certifiedFresh?: boolean;
  };
  genres?: string[];
  runTime?: number;
}

/**
 * Search for movies and TV shows.
 * Returns hits filtered to movies and TV shows only.
 */
export async function searchMulti(query: string): Promise<RTSearchResult[]> {
  if (!query.trim()) return [];

  const data = await rtFetch<RTSearchResponse>('/search', {
    query: query.trim(),
  });

  const hits = data.results?.[0]?.hits ?? [];

  return hits
    .filter((h): h is RawSearchHit & { type: 'movie' | 'tv' } =>
      h.type === 'movie' || h.type === 'tv',
    )
    .map((h) => ({
      emsId: h.emsId,
      type: h.type,
      title: h.title,
      description: h.description ?? '',
      releaseYear: h.releaseYear,
      posterImageUrl: h.posterImageUrl ?? null,
      rottenTomatoes: h.rottenTomatoes,
      genres: h.genres ?? [],
      runTime: h.runTime,
    }));
}

// ─── Movie details ────────────────────────────────────────────────────────────

interface RTMovieDetailsRaw {
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

/** Fetch full details for a movie. */
export async function getMovieDetails(emsId: string): Promise<RTMovieDetails> {
  const data = await rtFetch<Array<{ movieDetail: RTMovieDetailsRaw }>>('/movies/details', {
    emsId,
  });
  const detail = data[0]?.movieDetail;
  if (!detail) throw new Error(`No movie details found for emsId: ${emsId}`);
  return detail;
}

// ─── TV details ───────────────────────────────────────────────────────────────

/**
 * Fetch full details for a TV show including seasons.
 * NOTE: TV details endpoint path may need adjustment once confirmed from RapidAPI docs.
 */
export async function getTVDetails(emsId: string): Promise<RTTVDetails> {
  const data = await rtFetch<Array<{ tvDetail: RTTVDetails }>>('/tv/details', {
    emsId,
  });
  const detail = data[0]?.tvDetail;
  if (!detail) throw new Error(`No TV details found for emsId: ${emsId}`);
  return detail;
}
