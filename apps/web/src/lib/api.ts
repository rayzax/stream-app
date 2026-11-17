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

export interface CurrentUser {
  id: string;
  username: string;
  role: 'admin' | 'user';
}

export function login(username: string, password: string) {
  return request<{ ok: true; user: CurrentUser }>('/api/login', { method: 'POST', body: JSON.stringify({ username, password }) });
}

export function logout() {
  return request<{ ok: true }>('/api/logout', { method: 'POST' });
}

export function checkSession() {
  return request<{ ok: true; user: CurrentUser }>('/api/session');
}

// --- Admin -------------------------------------------------------------

export interface AdminUser {
  id: string;
  username: string;
  role: 'admin' | 'user';
  disabled: boolean;
  createdAt: string;
}

export function adminListUsers() {
  return request<{ users: AdminUser[] }>('/api/admin/users');
}

export function adminCreateUser(username: string, password: string, role: 'admin' | 'user') {
  return request<{ user: AdminUser }>('/api/admin/users', { method: 'POST', body: JSON.stringify({ username, password, role }) });
}

export function adminUpdateUser(id: string, patch: { role?: 'admin' | 'user'; disabled?: boolean; password?: string }) {
  return request<{ ok: true }>(`/api/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
}

export function adminDeleteUser(id: string) {
  return request<{ ok: true }>(`/api/admin/users/${id}`, { method: 'DELETE' });
}

export interface GameMapping {
  id: string;
  league: string;
  label: string;
  streamId: number;
  createdBy: string;
  updatedAt: string;
}

export function adminListMappings() {
  return request<{ mappings: GameMapping[] }>('/api/admin/mappings');
}

export function adminCreateMapping(league: string, label: string, streamId: number) {
  return request<{ mapping: GameMapping }>('/api/admin/mappings', { method: 'POST', body: JSON.stringify({ league, label, streamId }) });
}

export function adminDeleteMapping(id: string) {
  return request<{ ok: true }>(`/api/admin/mappings/${id}`, { method: 'DELETE' });
}

export interface LiveGame {
  league: string;
  name: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: string;
  awayScore: string;
  clock: string;
}

export function adminListUnmappedGames() {
  return request<{ leagues: Record<string, LiveGame[]> }>('/api/admin/unmapped-games');
}

export interface ChannelCategorySummary {
  categoryId: string;
  categoryName: string;
}

export function adminListChannelCategories() {
  return request<{ categories: ChannelCategorySummary[] }>('/api/admin/channel-categories');
}

export interface ChannelSummary {
  streamId: number;
  num: number;
  name: string;
}

export function adminListChannelsInCategory(categoryId: string) {
  return request<{ channels: ChannelSummary[] }>(`/api/admin/channel-categories/${categoryId}/channels`);
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
  mappingId?: string;
}

export function getSports() {
  return request<{ leagues: Record<string, SportsEntry[]>; lastRefreshed: string | null }>('/api/sports');
}

export interface ChannelView {
  streamId: number;
  num: number;
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

export function getTvGuide() {
  return request<{ channels: ChannelView[] }>('/api/tv/guide');
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
