/**
 * offlineDb.js — IndexedDB wrapper for offline attendance support
 * Uses raw IndexedDB API (no extra dependencies)
 * 
 * Safety: Safari private mode blocks IndexedDB entirely. All functions
 * are wrapped so the app gracefully degrades instead of crashing.
 */

const DB_NAME = 'ssp-offline-db';
const DB_VERSION = 1;
const STORE_QUEUE    = 'attendance_queue';   // pending records waiting to sync
const STORE_STUDENTS = 'cached_students';    // student roster for offline use

// ── IndexedDB availability check ─────────────────────────────────────────────

let _dbUnavailable = false;

function openDB() {
  if (_dbUnavailable) return Promise.reject(new Error('IndexedDB not available'));

  return new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_QUEUE)) {
          db.createObjectStore(STORE_QUEUE, { keyPath: 'localId', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains(STORE_STUDENTS)) {
          db.createObjectStore(STORE_STUDENTS, { keyPath: 'id' });
        }
      };

      request.onsuccess  = () => resolve(request.result);
      request.onerror    = () => {
        _dbUnavailable = true;
        reject(request.error);
      };
      request.onblocked  = () => {
        console.warn('[offlineDb] IndexedDB blocked — another tab may be open');
        reject(new Error('IndexedDB blocked'));
      };
    } catch (err) {
      // Private/incognito mode in Safari throws here
      _dbUnavailable = true;
      reject(err);
    }
  });
}

// ── Attendance Queue ──────────────────────────────────────────────────────────

/**
 * Save one attendance record to the offline queue.
 */
export async function saveOfflineAttendance(record) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx    = db.transaction(STORE_QUEUE, 'readwrite');
      const store = tx.objectStore(STORE_QUEUE);
      store.add({ ...record, queued_at: new Date().toISOString() });
      tx.oncomplete = () => resolve();
      tx.onerror    = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[offlineDb] saveOfflineAttendance failed:', err.message);
  }
}

/**
 * Get all pending attendance records from the queue.
 */
export async function getOfflineQueue() {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx      = db.transaction(STORE_QUEUE, 'readonly');
      const store   = tx.objectStore(STORE_QUEUE);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror   = () => reject(request.error);
    });
  } catch (err) {
    console.warn('[offlineDb] getOfflineQueue failed:', err.message);
    return [];
  }
}

/**
 * Delete a single record from the queue by its localId (after successful sync).
 */
export async function deleteOfflineRecord(localId) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx    = db.transaction(STORE_QUEUE, 'readwrite');
      const store = tx.objectStore(STORE_QUEUE);
      store.delete(localId);
      tx.oncomplete = () => resolve();
      tx.onerror    = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[offlineDb] deleteOfflineRecord failed:', err.message);
  }
}

/**
 * Clear the entire queue (called after a successful bulk sync).
 */
export async function clearOfflineQueue() {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx    = db.transaction(STORE_QUEUE, 'readwrite');
      const store = tx.objectStore(STORE_QUEUE);
      store.clear();
      tx.oncomplete = () => resolve();
      tx.onerror    = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[offlineDb] clearOfflineQueue failed:', err.message);
  }
}

/**
 * Get the number of pending records.
 */
export async function getQueueCount() {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx      = db.transaction(STORE_QUEUE, 'readonly');
      const store   = tx.objectStore(STORE_QUEUE);
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror   = () => reject(request.error);
    });
  } catch (err) {
    console.warn('[offlineDb] getQueueCount failed:', err.message);
    return 0;
  }
}

// ── Student Roster Cache ──────────────────────────────────────────────────────

/**
 * Cache the full student roster for offline use.
 */
export async function cacheStudents(students) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx    = db.transaction(STORE_STUDENTS, 'readwrite');
      const store = tx.objectStore(STORE_STUDENTS);
      store.clear();
      students.forEach(s => store.put(s));
      tx.oncomplete = () => resolve();
      tx.onerror    = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[offlineDb] cacheStudents failed:', err.message);
  }
}

/**
 * Get the cached student roster.
 */
export async function getCachedStudents() {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx      = db.transaction(STORE_STUDENTS, 'readonly');
      const store   = tx.objectStore(STORE_STUDENTS);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror   = () => reject(request.error);
    });
  } catch (err) {
    console.warn('[offlineDb] getCachedStudents failed:', err.message);
    return [];
  }
}
