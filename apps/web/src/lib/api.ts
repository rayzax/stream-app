const BASE = ''; // same-origin in production; Vite dev proxy handles /api in dev

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `http_${res.status}` }));
    throw Object.assign(new Error(err.error ?? `Request failed: ${res.status}`), { status: res.status });
  }
  return res.json() as Promise<T>;
}

export function login(password: string) {
  return request<{ ok: true }>('/api/login', { method: 'POST', body: JSON.stringify({ password }) });
}

export function logout() {
  return request<{ ok: true }>('/api/logout', { method: 'POST' });
}

export function checkSession() {
  return request<{ ok: true }>('/api/session');
}

export interface SportsEntry {
  streamId: number;
  name: string;
  league: string;
  homeTeam?: string;
  awayTeam?: string;
  homeScore?: string;
  awayScore?: string;
  clock?: string;
}

export function getSports() {
  return request<{ leagues: Record<string, SportsEntry[]>; lastRefreshed: string | null }>('/api/sports');
}

export interface ChannelView {
  streamId: number;
  name: string;
  logo: string;
  categoryName: string;
  now?: { title: string; start: string; stop: string };
  next?: { title: string; start: string; stop: string };
}

export interface TvCategory {
  categoryId: string;
  categoryName: string;
  channels: ChannelView[];
}

export function getTv() {
  return request<{ categories: TvCategory[] }>('/api/tv');
}

export interface MovieView {
  streamId: number;
  name: string;
  logo: string;
  categoryName: string;
  rating: string;
  containerExtension: string;
  added: number;
}

export interface MovieCategory {
  categoryId: string;
  categoryName: string;
  movies: MovieView[];
}

export function getMovies() {
  return request<{ categories: MovieCategory[] }>('/api/movies');
}

export function getMovieDetails(id: number) {
  return request<{ info: Record<string, unknown>; movie_data: { stream_id: number; container_extension: string } }>(
    `/api/movies/${id}`,
  );
}

export interface SearchResult {
  type: 'live' | 'vod';
  streamId: number;
  name: string;
  categoryName: string;
}

export function search(q: string) {
  return request<{ live: SearchResult[]; vod: SearchResult[] }>(`/api/search?q=${encodeURIComponent(q)}`);
}

export function getStreamToken(streamId: number, type: 'live' | 'vod', ext?: string) {
  return request<{ url: string; via: 'homelab' | 'cloud'; expiresInSeconds: number }>('/api/stream-token', {
    method: 'POST',
    body: JSON.stringify({ streamId, type, ext }),
  });
}
