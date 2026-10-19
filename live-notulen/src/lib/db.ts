// IndexedDB: simpan sesi notulen per meeting (riwayat), hanya di browser user.
import type { AgendaItem, Segment, Task } from "../store";

export interface SessionRecord {
  id: string;
  title: string;
  createdAt: number;
  meetingAt?: number; // tidak ada di notulen lama → pakai createdAt
  meetingEndAt?: number; // tidak ada di notulen lama → mulai + 1 jam
  updatedAt: number;
  segments: Segment[];
  speakerNames: Record<number, string>;
  translations: Record<string, string | null>;
  agenda?: AgendaItem[];
  tasks?: Task[];
  archived?: boolean;
  vocab?: string;
}

const DB = "live-notulen", STORE = "sessions";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" }).createIndex("updatedAt", "updatedAt");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const saveSession = (s: SessionRecord) => tx("readwrite", (st) => st.put(s));
export const getSession = (id: string) => tx<SessionRecord | undefined>("readonly", (st) => st.get(id));
export const deleteSession = (id: string) => tx("readwrite", (st) => st.delete(id));
export const listSessions = async () =>
  (await tx<SessionRecord[]>("readonly", (st) => st.getAll())).sort((a, b) => b.updatedAt - a.updatedAt);
