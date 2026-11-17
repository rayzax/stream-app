import { Firestore } from '@google-cloud/firestore';

export interface WatchHistoryEntry {
  /** Identity/dedup key: the movie's own streamId, or the series_id for a show. */
  streamId: number;
  type: 'vod' | 'series';
  name: string;
  logo: string;
  /** The id to actually request a stream-token for — same as streamId for a movie; the specific episode's id for a series, so "Continue Watching" resumes straight into playback. */
  playStreamId: number;
  ext: string;
  watchedAt: string;
}

interface WatchHistoryDoc {
  streamId: number;
  type: 'vod' | 'series';
  name: string;
  logo: string;
  playStreamId: number;
  ext: string;
  watchedAt: string;
}

const COLLECTION = 'watch-history';

export class WatchHistoryStore {
  private db = new Firestore();

  /** One doc per (user, type, title) — repeat views just bump watchedAt instead of piling up duplicates. */
  async record(userId: string, entry: Omit<WatchHistoryEntry, 'watchedAt'>): Promise<void> {
    const doc: WatchHistoryDoc = { ...entry, watchedAt: new Date().toISOString() };
    await this.db
      .collection(COLLECTION)
      .doc(userId)
      .collection('items')
      .doc(`${entry.type}:${entry.streamId}`)
      .set(doc);
  }

  async list(userId: string, limit = 20): Promise<WatchHistoryEntry[]> {
    const snap = await this.db
      .collection(COLLECTION)
      .doc(userId)
      .collection('items')
      .orderBy('watchedAt', 'desc')
      .limit(limit)
      .get();
    return snap.docs.map((d) => d.data() as WatchHistoryEntry);
  }
}
