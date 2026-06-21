/**
 * syncEngine.js — Background sync engine for offline attendance
 *
 * Strategy:
 *  1. On boot: attempt sync after 2 s if online
 *  2. On 'online' event: attempt sync after 1.5 s debounce
 *  3. Periodic: every 30 s if online + pending records exist
 *  4. Per-record sync: on bulk failure, fall back to one-by-one
 *     and only delete successfully synced records — failed ones stay.
 */

import { supabase } from './supabase';
import {
  getOfflineQueue,
  deleteOfflineRecord,
  clearOfflineQueue,
  getQueueCount
} from './offlineDb';

let isSyncing = false;
let listeners = [];
let retryInterval = null;

// ── Listener API ──────────────────────────────────────────────────────────────

export function onSyncStateChange(callback) {
  listeners.push(callback);
  return () => { listeners = listeners.filter(l => l !== callback); };
}

function notify(state) {
  listeners.forEach(cb => { try { cb(state); } catch (e) { /* ignore */ } });
}

// ── Core Sync Logic ───────────────────────────────────────────────────────────

export async function syncOfflineRecords() {
  if (isSyncing || !navigator.onLine) return;

  const queue = await getOfflineQueue();
  if (queue.length === 0) return;

  isSyncing = true;
  notify({ syncing: true, pendingCount: queue.length, lastResult: null });
  console.log(`[SyncEngine] Starting sync of ${queue.length} queued records...`);

  try {
    // Strip local-only fields, filter malformed records
    const valid = queue
      .filter(r => r.student_id && r.session_date && r.session_type && r.is_present !== undefined)
      .map(({ localId, queued_at, ...rest }) => ({ ...rest, _localId: localId }));

    if (valid.length === 0) {
      await clearOfflineQueue();
      notify({ syncing: false, pendingCount: 0, lastResult: 'success' });
      isSyncing = false;
      return;
    }

    // Deduplicate: keep only the latest entry per student+date+type
    const deduped = {};
    valid.forEach(r => {
      const key = `${r.student_id}_${r.session_date}_${r.session_type}`;
      deduped[key] = r; // later entry wins
    });
    const unique = Object.values(deduped);
    const records = unique.map(({ _localId, ...rest }) => rest);
    const localIds = unique.map(r => r._localId);

    // ── Attempt 1: bulk upsert ──────────────────────────────────
    const { error: bulkErr } = await supabase
      .from('attendance')
      .upsert(records, { onConflict: 'student_id, session_date, session_type' });

    if (!bulkErr) {
      // Bulk success — clear entire queue
      await clearOfflineQueue();
      notify({ syncing: false, pendingCount: 0, lastResult: 'success' });
      console.log(`[SyncEngine] ✅ Bulk synced ${records.length} records`);
      window.dispatchEvent(new CustomEvent('attendance-synced'));
      return;
    }

    // ── Attempt 2: one-by-one with surgical deletion ────────────
    console.warn('[SyncEngine] Bulk failed, falling back to per-record sync:', bulkErr.message);
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < records.length; i++) {
      const record  = records[i];
      const localId = localIds[i];
      try {
        const { error: singleErr } = await supabase
          .from('attendance')
          .upsert(record, { onConflict: 'student_id, session_date, session_type' });

        if (!singleErr) {
          // Only delete THIS record — don't touch failed ones
          await deleteOfflineRecord(localId);
          successCount++;
        } else {
          console.error(`[SyncEngine] ❌ Record ${record.student_id} failed:`, singleErr.message);
          failCount++;
        }
      } catch (e) {
        console.error(`[SyncEngine] ❌ Exception on ${record.student_id}:`, e.message);
        failCount++;
      }
    }

    const remaining = await getQueueCount();
    const result = failCount === 0 ? 'success' : (successCount > 0 ? 'partial' : 'error');
    notify({ syncing: false, pendingCount: remaining, lastResult: result });

    if (successCount > 0) {
      window.dispatchEvent(new CustomEvent('attendance-synced'));
    }
    if (failCount > 0) {
      window.dispatchEvent(new CustomEvent('sync-error', {
        detail: `${failCount} record(s) failed to sync. Will retry automatically.`
      }));
    }

  } catch (err) {
    console.error('[SyncEngine] Sync exception:', err.message || err);
    window.dispatchEvent(new CustomEvent('sync-error', {
      detail: `Sync error: ${err.message || 'Unknown error'}`
    }));
    const remaining = await getQueueCount();
    notify({ syncing: false, pendingCount: remaining, lastResult: 'error' });
  } finally {
    isSyncing = false;
  }
}

// ── Periodic Retry ────────────────────────────────────────────────────────────

async function startPeriodicRetry() {
  if (retryInterval) return;
  retryInterval = setInterval(async () => {
    if (!navigator.onLine) return;
    const count = await getQueueCount();
    if (count > 0) {
      console.log(`[SyncEngine] Periodic retry — ${count} records pending`);
      syncOfflineRecords();
    }
  }, 30_000); // every 30 seconds
}

// ── Init ──────────────────────────────────────────────────────────────────────

export function initSyncEngine() {
  // Attempt sync on boot if online
  if (navigator.onLine) {
    setTimeout(syncOfflineRecords, 2000);
  }

  // Sync when coming back online (with small debounce)
  window.addEventListener('online', () => {
    console.log('[SyncEngine] Back online — syncing...');
    setTimeout(syncOfflineRecords, 1500);
  });

  // Update listeners when going offline
  window.addEventListener('offline', async () => {
    console.log('[SyncEngine] Went offline');
    const count = await getQueueCount();
    notify({ syncing: false, pendingCount: count, lastResult: null });
  });

  // Always run periodic retry (it no-ops when queue is empty)
  startPeriodicRetry();
}
