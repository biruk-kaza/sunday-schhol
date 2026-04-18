/**
 * syncEngine.js — Background sync engine for offline attendance
 * Pushes queued records to Supabase when internet is restored.
 */

import { supabase } from './supabase';
import { getOfflineQueue, clearOfflineQueue, getQueueCount } from './offlineDb';

let isSyncing = false;
let listeners = [];

/**
 * Subscribe to sync state changes
 */
export function onSyncStateChange(callback) {
  listeners.push(callback);
  return () => {
    listeners = listeners.filter(l => l !== callback);
  };
}

function notifyListeners(state) {
  listeners.forEach(cb => {
    try { cb(state); } catch (e) { console.error('Sync listener error:', e); }
  });
}

/**
 * Attempt to sync all queued attendance records to Supabase
 */
export async function syncOfflineRecords() {
  if (isSyncing || !navigator.onLine) return;

  const queue = await getOfflineQueue();
  if (queue.length === 0) return;

  isSyncing = true;
  notifyListeners({ syncing: true, pendingCount: queue.length, lastResult: null });

  try {
    // Prepare records for upsert (strip local-only fields)
    const records = queue.map(({ localId, queued_at, ...rest }) => rest);

    // Deduplicate: keep only the latest record per student+date+type
    const deduped = {};
    records.forEach(r => {
      const key = `${r.student_id}_${r.session_date}_${r.session_type}`;
      deduped[key] = r; // later entries overwrite earlier ones
    });
    const uniqueRecords = Object.values(deduped);

    const { data, error } = await supabase
      .from('attendance')
      .upsert(uniqueRecords, { onConflict: 'student_id, session_date, session_type' });

    if (error) {
      console.error('[SyncEngine] Supabase upsert error:', error);
      throw error;
    }

    // All synced — clear the queue
    await clearOfflineQueue();
    
    notifyListeners({ syncing: false, pendingCount: 0, lastResult: 'success' });
    console.log(`[SyncEngine] Successfully synced ${uniqueRecords.length} records`);

    // Dispatch event so pages can reload their data
    window.dispatchEvent(new CustomEvent('attendance-synced'));
  } catch (err) {
    console.error('[SyncEngine] Sync failed:', err.message || err);
    const remaining = await getQueueCount();
    notifyListeners({ syncing: false, pendingCount: remaining, lastResult: 'error' });
  } finally {
    isSyncing = false;
  }
}

/**
 * Initialize the sync engine — call once at app boot
 */
export function initSyncEngine() {
  // Try syncing immediately on boot if online
  if (navigator.onLine) {
    setTimeout(syncOfflineRecords, 2000);
  }

  // Sync when coming back online
  window.addEventListener('online', () => {
    console.log('[SyncEngine] Back online — starting sync...');
    setTimeout(syncOfflineRecords, 1500);
  });

  // Notify listeners when going offline
  window.addEventListener('offline', async () => {
    console.log('[SyncEngine] Went offline');
    const count = await getQueueCount();
    notifyListeners({ syncing: false, pendingCount: count, lastResult: null });
  });
}
