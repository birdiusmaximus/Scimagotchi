/**
 * Local persistence (brief §12). A small document-store adapter keeps records on
 * device. On native it uses expo-sqlite (see `sqliteAdapter.ts`); on web (the dev
 * preview) it uses localStorage / in-memory. Records are typed in TS (mirroring
 * the §12.4 schema) and stored as JSON for v0.1 — the repo interface hides this so
 * columns can be normalised later. Nothing leaves the device.
 */

import { Platform } from 'react-native';

import { SqliteAdapter } from '@/services/db/sqliteAdapter';

export type Collection =
  | 'conversations'
  | 'messages'
  | 'emotion_events'
  | 'emotion_progress'
  | 'weekly_summaries'
  | 'safety_events'
  | 'app_settings';

export interface Adapter {
  ready(): Promise<void>;
  getAll<T>(c: Collection): Promise<T[]>;
  getById<T>(c: Collection, id: string): Promise<T | null>;
  put<T extends { id: string }>(c: Collection, record: T): Promise<void>;
  remove(c: Collection, id: string): Promise<void>;
  clearAll(): Promise<void>;
}

const COLLECTIONS: Collection[] = [
  'conversations',
  'messages',
  'emotion_events',
  'emotion_progress',
  'weekly_summaries',
  'safety_events',
  'app_settings',
];

// ── Web / fallback: collection-as-array in localStorage (or memory) ──────────
export class WebAdapter implements Adapter {
  private mem = new Map<Collection, unknown[]>();

  private get store(): Storage | null {
    try {
      return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
    } catch {
      return null;
    }
  }

  private load(c: Collection): unknown[] {
    if (this.mem.has(c)) return this.mem.get(c)!;
    let arr: unknown[] = [];
    const raw = this.store?.getItem(`scima:${c}`);
    if (raw) {
      try {
        arr = JSON.parse(raw);
      } catch {
        arr = [];
      }
    }
    this.mem.set(c, arr);
    return arr;
  }

  private save(c: Collection) {
    try {
      this.store?.setItem(`scima:${c}`, JSON.stringify(this.mem.get(c) ?? []));
    } catch {
      // memory-only fallback
    }
  }

  async ready() {}

  async getAll<T>(c: Collection) {
    return [...this.load(c)] as T[];
  }

  async getById<T>(c: Collection, id: string) {
    return ((this.load(c) as { id: string }[]).find((r) => r.id === id) as T) ?? null;
  }

  async put<T extends { id: string }>(c: Collection, record: T) {
    const arr = this.load(c) as { id: string }[];
    const i = arr.findIndex((r) => r.id === record.id);
    if (i >= 0) arr[i] = record;
    else arr.push(record);
    this.save(c);
  }

  async remove(c: Collection, id: string) {
    this.mem.set(c, (this.load(c) as { id: string }[]).filter((r) => r.id !== id));
    this.save(c);
  }

  async clearAll() {
    for (const c of COLLECTIONS) {
      this.mem.set(c, []);
      try {
        this.store?.removeItem(`scima:${c}`);
      } catch {
        /* noop */
      }
    }
  }
}

let adapter: Adapter | null = null;

export function db(): Adapter {
  if (!adapter) adapter = Platform.OS === 'web' ? new WebAdapter() : new SqliteAdapter();
  return adapter;
}

export async function initDb(): Promise<void> {
  try {
    await db().ready();
  } catch (e) {
    // Never block the app on storage; fall back to in-memory web adapter.
    console.warn('[scimagotchi] storage init failed, using in-memory fallback', e);
    adapter = new WebAdapter();
    await adapter.ready();
  }
}
