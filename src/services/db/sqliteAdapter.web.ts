/**
 * Web stub for the native SQLite adapter. The persistence factory never
 * instantiates this on web (it uses the localStorage WebAdapter); this file just
 * keeps the `expo-sqlite` import out of the web bundle.
 */

import type { Adapter, Collection } from '@/services/db/persistence';

export class SqliteAdapter implements Adapter {
  async ready(): Promise<void> {
    throw new Error('SqliteAdapter is not available on web');
  }
  async getAll<T>(_c: Collection): Promise<T[]> {
    return [];
  }
  async getById<T>(_c: Collection, _id: string): Promise<T | null> {
    return null;
  }
  async put<T extends { id: string }>(_c: Collection, _record: T): Promise<void> {}
  async remove(_c: Collection, _id: string): Promise<void> {}
  async clearAll(): Promise<void> {}
}
