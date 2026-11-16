import { Firestore } from '@google-cloud/firestore';
import bcrypt from 'bcrypt';

export type Role = 'admin' | 'user';

export interface UserRecord {
  id: string;
  username: string;
  role: Role;
  disabled: boolean;
  createdAt: string;
}

interface UserDoc {
  username: string;
  passwordHash: string;
  role: Role;
  disabled: boolean;
  createdAt: string;
}

const COLLECTION = 'users';

function toRecord(id: string, doc: UserDoc): UserRecord {
  return { id, username: doc.username, role: doc.role, disabled: doc.disabled, createdAt: doc.createdAt };
}

export class UserStore {
  private db = new Firestore();

  async getById(id: string): Promise<UserRecord | null> {
    const snap = await this.db.collection(COLLECTION).doc(id).get();
    if (!snap.exists) return null;
    return toRecord(snap.id, snap.data() as UserDoc);
  }

  /** Returns the record AND password hash — only for login verification, never exposed otherwise. */
  async getByUsernameWithHash(username: string): Promise<(UserRecord & { passwordHash: string }) | null> {
    const snap = await this.db.collection(COLLECTION).where('username', '==', username.toLowerCase()).limit(1).get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    const data = doc.data() as UserDoc;
    return { ...toRecord(doc.id, data), passwordHash: data.passwordHash };
  }

  async list(): Promise<UserRecord[]> {
    const snap = await this.db.collection(COLLECTION).orderBy('createdAt', 'asc').get();
    return snap.docs.map((d) => toRecord(d.id, d.data() as UserDoc));
  }

  async create(username: string, password: string, role: Role): Promise<UserRecord> {
    const normalized = username.trim().toLowerCase();
    const existing = await this.getByUsernameWithHash(normalized);
    if (existing) throw Object.assign(new Error('username_taken'), { code: 'username_taken' });

    const passwordHash = await bcrypt.hash(password, 12);
    const doc: UserDoc = { username: normalized, passwordHash, role, disabled: false, createdAt: new Date().toISOString() };
    const ref = await this.db.collection(COLLECTION).add(doc);
    return toRecord(ref.id, doc);
  }

  async setRole(id: string, role: Role): Promise<void> {
    await this.db.collection(COLLECTION).doc(id).update({ role });
  }

  async setDisabled(id: string, disabled: boolean): Promise<void> {
    await this.db.collection(COLLECTION).doc(id).update({ disabled });
  }

  async resetPassword(id: string, newPassword: string): Promise<void> {
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.db.collection(COLLECTION).doc(id).update({ passwordHash });
  }

  async delete(id: string): Promise<void> {
    await this.db.collection(COLLECTION).doc(id).delete();
  }

  async countAdmins(): Promise<number> {
    const snap = await this.db.collection(COLLECTION).where('role', '==', 'admin').where('disabled', '==', false).get();
    return snap.size;
  }
}
