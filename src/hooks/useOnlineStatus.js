import { useState, useEffect } from 'react';
import { onSyncStateChange } from '../lib/syncEngine';
import { getQueueCount } from '../lib/offlineDb';

/**
 * React hook that tracks network status and sync state
 * Returns { isOnline, syncing, pendingCount, lastResult }
 */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncState, setSyncState] = useState({
    syncing: false,
    pendingCount: 0,
    lastResult: null
  });

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Subscribe to sync engine state
    const unsubscribe = onSyncStateChange((state) => {
      setSyncState(state);
    });

    // Get initial pending count
    getQueueCount().then(count => {
      if (count > 0) {
        setSyncState(prev => ({ ...prev, pendingCount: count }));
      }
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe();
    };
  }, []);

  return {
    isOnline,
    syncing: syncState.syncing,
    pendingCount: syncState.pendingCount,
    lastResult: syncState.lastResult
  };
}
