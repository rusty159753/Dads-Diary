import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

/**
 * Sync status for entries: synced (in Supabase), pending (waiting to sync), error (sync failed).
 */
export type SyncStatus = 'synced' | 'pending' | 'error';

/**
 * Journal entry schema matching Supabase table structure.
 * Local fields: sync_status, is_deleted for offline-first patterns.
 */
export interface JournalEntry {
  id: string;
  user_id: string;
  entry_date: string; // YYYY-MM-DD
  content: string;
  created_at: string; // ISO 8601
  updated_at: string; // ISO 8601
  sync_status: SyncStatus;
  is_deleted?: boolean;
}

/**
 * IndexedDB schema definition.
 */
interface DadsDB extends DBSchema {
  entries: {
    key: string;
    value: JournalEntry;
    indexes: {
      'by-user': string;
      'by-user-date': [string, string];
      'by-sync-status': SyncStatus;
    };
  };
}

const DB_NAME = 'dads-diary';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<DadsDB>> | null = null;

/**
 * Get or initialize the IndexedDB database.
 */
function getDb(): Promise<IDBPDatabase<DadsDB>> {
  if (!dbPromise) {
    dbPromise = openDB<DadsDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('entries')) {
          const store = db.createObjectStore('entries', { keyPath: 'id' });
          store.createIndex('by-user', 'user_id');
          store.createIndex('by-user-date', ['user_id', 'entry_date']);
          store.createIndex('by-sync-status', 'sync_status');
        }
      },
    });
  }
  return dbPromise;
}

/**
 * Convert a Date to YYYY-MM-DD string.
 */
export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Insert or update an entry in IndexedDB.
 */
export async function upsertEntry(entry: JournalEntry): Promise<void> {
  const db = await getDb();
  await db.put('entries', entry);
}

/**
 * Retrieve a single entry by user and date.
 */
export async function getEntryByUserAndDate(
  userId: string,
  dateKey: string
): Promise<JournalEntry | undefined> {
  const db = await getDb();
  return db.getFromIndex('entries', 'by-user-date', [userId, dateKey]);
}

/**
 * List all entries for a user, sorted by date (newest first).
 */
export async function listEntriesByUser(userId: string): Promise<JournalEntry[]> {
  const db = await getDb();
  const all = await db.getAllFromIndex('entries', 'by-user', userId);
  all.sort((a, b) => (a.entry_date < b.entry_date ? 1 : -1));
  return all;
}

/**
 * List entries pending sync (status !== 'synced').
 */
export async function listPendingEntries(userId: string): Promise<JournalEntry[]> {
  const db = await getDb();
  const all = await db.getAllFromIndex('entries', 'by-user', userId);
  return all.filter((e) => e.sync_status !== 'synced');
}

/**
 * Update sync status of an entry.
 */
export async function markEntrySyncStatus(id: string, status: SyncStatus): Promise<void> {
  const db = await getDb();
  const entry = await db.get('entries', id);
  if (!entry) return;

  entry.sync_status = status;
  entry.updated_at = new Date().toISOString();
  await db.put('entries', entry);
}

/**
 * Mark an entry as deleted (soft delete). Sets is_deleted flag and pending sync status.
 */
export async function markEntryDeleted(userId: string, dateKey: string): Promise<void> {
  const db = await getDb();
  const entry = await db.getFromIndex('entries', 'by-user-date', [userId, dateKey]);
  if (!entry) return;

  entry.is_deleted = true;
  entry.sync_status = 'pending';
  entry.updated_at = new Date().toISOString();
  await db.put('entries', entry);
}

/**
 * Permanently remove an entry from IndexedDB (called after successful remote delete).
 */
export async function purgeEntry(userId: string, dateKey: string): Promise<void> {
  const db = await getDb();
  const entry = await db.getFromIndex('entries', 'by-user-date', [userId, dateKey]);
  if (!entry) return;
  await db.delete('entries', entry.id);
}

/**
 * Clear all entries for a user (rarely used; typically for account deletion).
 */
export async function clearUserEntries(userId: string): Promise<void> {
  const db = await getDb();
  const all = await db.getAllFromIndex('entries', 'by-user', userId);
  for (const entry of all) {
    await db.delete('entries', entry.id);
  }
}
