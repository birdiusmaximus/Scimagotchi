/**
 * Native persistence adapter (expo-sqlite). Metro resolves this file on iOS /
 * Android; web gets `sqliteAdapter.web.ts` instead, so the SQLite WASM module is
 * never bundled for web. One `kv` table keyed by (collection, id) stores records
 * as JSON for v0.1.
 */

import * as SQLite from 'expo-sqlite';

import type { Adapter, Collection } from '@/services/db/persistence';

export class SqliteAdapter implements Adapter {
  private db: SQLite.SQLiteDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  ready(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = (async () => {
        this.db = await SQLite.openDatabaseAsync('scimagotchi.db');
        await this.db.execAsync(
          'CREATE TABLE IF NOT EXISTS kv (collection TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY (collection, id));',
        );
      })();
    }
    return this.initPromise;
  }

  private async require(): Promise<SQLite.SQLiteDatabase> {
    await this.ready();
    return this.db!;
  }

  async getAll<T>(c: Collection): Promise<T[]> {
    const db = await this.require();
    const rows = (await db.getAllAsync('SELECT data FROM kv WHERE collection = ?', [c])) as {
      data: string;
    }[];
    return rows.map((r) => JSON.parse(r.data) as T);
  }

  async getById<T>(c: Collection, id: string): Promise<T | null> {
    const db = await this.require();
    const row = (await db.getFirstAsync('SELECT data FROM kv WHERE collection = ? AND id = ?', [
      c,
      id,
    ])) as { data: string } | null;
    return row ? (JSON.parse(row.data) as T) : null;
  }

  async put<T extends { id: string }>(c: Collection, record: T): Promise<void> {
    const db = await this.require();
    await db.runAsync('INSERT OR REPLACE INTO kv (collection, id, data) VALUES (?, ?, ?)', [
      c,
      record.id,
      JSON.stringify(record),
    ]);
  }

  async remove(c: Collection, id: string): Promise<void> {
    const db = await this.require();
    await db.runAsync('DELETE FROM kv WHERE collection = ? AND id = ?', [c, id]);
  }

  async clearAll(): Promise<void> {
    const db = await this.require();
    await db.execAsync('DELETE FROM kv;');
  }
}
