import { Firestore } from '@google-cloud/firestore';

export interface GameMapping {
  id: string;
  league: string;
  label: string; // e.g. "Bears at Packers" — shown in place of/alongside the channel name
  streamId: number;
  createdBy: string;
  updatedAt: string;
}

interface GameMappingDoc {
  league: string;
  label: string;
  streamId: number;
  createdBy: string;
  updatedAt: string;
}

const COLLECTION = 'game-mappings';

export class GameMappingStore {
  private db = new Firestore();

  async list(): Promise<GameMapping[]> {
    const snap = await this.db.collection(COLLECTION).orderBy('updatedAt', 'desc').get();
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as GameMappingDoc) }));
  }

  async upsert(input: { league: string; label: string; streamId: number; createdBy: string }): Promise<GameMapping> {
    const doc: GameMappingDoc = { ...input, updatedAt: new Date().toISOString() };
    const ref = await this.db.collection(COLLECTION).add(doc);
    return { id: ref.id, ...doc };
  }

  async delete(id: string): Promise<void> {
    await this.db.collection(COLLECTION).doc(id).delete();
  }
}
