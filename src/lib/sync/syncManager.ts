import { supabase } from '@/lib/supabase/client';
import {
  type JournalEntry,
  type SyncStatus,
  listEntriesByUser,
  markEntrySyncStatus,
  getEntryByUserAndDate,
  listPendingEntries,
  upsertEntry,
  purgeEntry,
} from '@/lib/db/indexeddb';
import { shouldPushLocal } from '@/lib/sync/conflict';

interface RemoteEntry {
  id: string;
  user_id: string;
  entry_date: string;
  content: string;
  created_at: string;
  updated_at: string;
}

/**
 * Fetch a remote entry by user and date.
 */
async function fetchRemoteByDate(
  userId: string,
  entryDate: string
): Promise<RemoteEntry | null> {
  const { data, error } = await supabase
    .from('entries')
    .select('id,user_id,entry_date,content,created_at,updated_at')
    .eq('user_id', userId)
    .eq('entry_date', entryDate)
    .maybeSingle();

  if (error) throw error;
  return data as RemoteEntry | null;
}

/**
 * Upsert an entry to Supabase using the composite key (user_id, entry_date).
 */
async function upsertRemote(entry: JournalEntry): Promise<RemoteEntry> {
  const { data, error } = await supabase
    .from('entries')
    .upsert(
      {
        id: entry.id,
        user_id: entry.user_id,
        entry_date: entry.entry_date,
        content: entry.content,
      },
      { onConflict: 'user_id,entry_date' }
    )
    .select('id,user_id,entry_date,content,created_at,updated_at')
    .single();

  if (error) throw error;
  return data as RemoteEntry;
}

/**
 * Delete an entry from Supabase.
 */
async function deleteRemote(userId: string, entryDate: string): Promise<void> {
  const { error } = await supabase
    .from('entries')
    .delete()
    .eq('user_id', userId)
    .eq('entry_date', entryDate);

  if (error) throw error;
}

/**
 * Execute a full sync cycle: push pending entries, then pull remote changes.
 */
export async function syncNow(userId: string): Promise<void> {
  // Push phase: send all pending/error entries
  const pending = await listPendingEntries(userId);

  for (const local of pending) {
    try {
      // Check if remote exists
      const remote = await fetchRemoteByDate(userId, local.entry_date);

      // Handle soft-deleted entries
      if (local.is_deleted) {
        if (remote) {
          await deleteRemote(userId, local.entry_date);
        }
        // Remove from local DB after successful remote delete
        await purgeEntry(userId, local.entry_date);
        continue;
      }

      // New entry (no remote version)
      if (!remote) {
        const saved = await upsertRemote(local);
        await upsertEntry({
          ...local,
          id: saved.id,
          created_at: saved.created_at,
          updated_at: saved.updated_at,
          sync_status: 'synced',
          is_deleted: false,
        });
        continue;
      }

      // Conflict resolution: decide push vs pull
      if (shouldPushLocal(local, remote)) {
        const saved = await upsertRemote(local);
        await upsertEntry({
          ...local,
          id: saved.id,
          created_at: saved.created_at,
          updated_at: saved.updated_at,
          sync_status: 'synced',
          is_deleted: false,
        });
      } else {
        // Pull remote version (overwrite local)
        await upsertEntry({
          ...remote,
          sync_status: 'synced',
          is_deleted: false,
        });
      }
    } catch (error) {
      // Mark entry with error status for retry
      await markEntrySyncStatus(local.id, 'error');
    }
  }

  // Pull phase: fetch recent remote changes (last 30 days)
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const sinceKey = since.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from('entries')
    .select('id,user_id,entry_date,content,created_at,updated_at')
    .eq('user_id', userId)
    .gte('entry_date', sinceKey)
    .order('entry_date', { ascending: false });

  if (error) throw error;

  const remotes = (data ?? []) as RemoteEntry[];
  for (const remote of remotes) {
    const local = await getEntryByUserAndDate(userId, remote.entry_date);

    // Only update if local is already synced (avoid overwriting pending work)
    if (!local || local.sync_status === 'synced') {
      await upsertEntry({
        ...remote,
        sync_status: 'synced',
        is_deleted: false,
      });
    }
  }
}

/**
 * Start auto-sync listener. Syncs when device comes online.
 * Returns cleanup function to stop listening.
 */
export function startAutoSync(userId: string): () => void {
  const handleOnline = async () => {
    try {
      await syncNow(userId);
    } catch (error) {
      console.error('Auto-sync failed:', error);
      // Sync errors are tracked per-entry via sync_status
    }
  };

  // Initial sync
  if (navigator.onLine) {
    handleOnline();
  }

  // Listen for reconnect
  window.addEventListener('online', handleOnline);

  // Return cleanup function
  return () => {
    window.removeEventListener('online', handleOnline);
  };
}
