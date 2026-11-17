export interface XtreamCategory {
  category_id: string;
  category_name: string;
  parent_id: number;
}

export interface XtreamLiveStream {
  num: number;
  name: string;
  stream_type: string;
  stream_id: number;
  stream_icon: string;
  epg_channel_id: string | null;
  category_id: string;
  tv_archive: number;
}

export interface XtreamVodStream {
  num: number;
  name: string;
  stream_type: string;
  stream_id: number;
  stream_icon: string;
  rating: string;
  added: string;
  category_id: string;
  container_extension: string;
}

export interface XtreamVodInfo {
  info: Record<string, unknown> & { plot?: string; genre?: string; releasedate?: string; rating?: string };
  movie_data: { stream_id: number; container_extension: string };
}

export interface XtreamSeries {
  num: number;
  name: string;
  series_id: number;
  cover: string;
  plot?: string;
  genre?: string;
  releaseDate?: string;
  rating: string;
  category_id: string;
  last_modified: string;
}

export interface XtreamSeriesEpisode {
  id: string;
  episode_num: number;
  title: string;
  container_extension: string;
  season: number;
  info?: { plot?: string; duration?: string };
}

export interface XtreamSeriesInfo {
  seasons: Array<{ season_number: number; name: string; episode_count: number; cover?: string; overview?: string }>;
  info: Record<string, unknown> & { name?: string; plot?: string; genre?: string; cover?: string };
  episodes: Record<string, XtreamSeriesEpisode[]>;
}

export interface XtreamClientOptions {
  server: string;
  username: string;
  password: string;
}

export class XtreamClient {
  constructor(private opts: XtreamClientOptions) {}

  private apiUrl(action: string, extraParams: Record<string, string> = {}): string {
    const base = this.opts.server.replace(/\/+$/, '');
    const params = new URLSearchParams({
      username: this.opts.username,
      password: this.opts.password,
      action,
      ...extraParams,
    });
    return `${base}/player_api.php?${params.toString()}`;
  }

  private async getJson<T>(url: string): Promise<T> {
    // Some of these (get_live_streams, get_vod_streams) return multi-MB
    // JSON for a full IPTV catalog — 15s was too tight in practice and
    // silently discarded the entire catalog refresh. See also: refreshFull
    // uses Promise.allSettled, not Promise.all, so one slow endpoint can no
    // longer take the others down with it.
    const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
    if (!res.ok) {
      throw new Error(`Xtream API error ${res.status} for ${new URL(url).searchParams.get('action')}`);
    }
    return (await res.json()) as T;
  }

  getLiveCategories(): Promise<XtreamCategory[]> {
    return this.getJson(this.apiUrl('get_live_categories'));
  }

  getLiveStreams(categoryId?: string): Promise<XtreamLiveStream[]> {
    return this.getJson(this.apiUrl('get_live_streams', categoryId ? { category_id: categoryId } : {}));
  }

  getVodCategories(): Promise<XtreamCategory[]> {
    return this.getJson(this.apiUrl('get_vod_categories'));
  }

  getVodStreams(categoryId?: string): Promise<XtreamVodStream[]> {
    return this.getJson(this.apiUrl('get_vod_streams', categoryId ? { category_id: categoryId } : {}));
  }

  getVodInfo(vodId: number): Promise<XtreamVodInfo> {
    return this.getJson(this.apiUrl('get_vod_info', { vod_id: String(vodId) }));
  }

  getSeriesCategories(): Promise<XtreamCategory[]> {
    return this.getJson(this.apiUrl('get_series_categories'));
  }

  getSeries(categoryId?: string): Promise<XtreamSeries[]> {
    return this.getJson(this.apiUrl('get_series', categoryId ? { category_id: categoryId } : {}));
  }

  getSeriesInfo(seriesId: number): Promise<XtreamSeriesInfo> {
    return this.getJson(this.apiUrl('get_series_info', { series_id: String(seriesId) }));
  }

  async getXmltv(): Promise<string> {
    const base = this.opts.server.replace(/\/+$/, '');
    const params = new URLSearchParams({ username: this.opts.username, password: this.opts.password });
    const res = await fetch(`${base}/xmltv.php?${params.toString()}`, { signal: AbortSignal.timeout(90_000) });
    if (!res.ok) throw new Error(`xmltv.php error ${res.status}`);
    return res.text();
  }
}
