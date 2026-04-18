import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw, CheckCircle2, CloudOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export default function NetworkBanner() {
  const { isOnline, syncing, pendingCount, lastResult } = useOnlineStatus();
  const [showSuccess, setShowSuccess] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isOnline || pendingCount > 0 || syncing) {
      setVisible(true);
      setShowSuccess(false);
    } else if (lastResult === 'success') {
      setShowSuccess(true);
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        setShowSuccess(false);
      }, 3000);
      return () => clearTimeout(timer);
    } else {
      setVisible(false);
    }
  }, [isOnline, syncing, pendingCount, lastResult]);

  if (!visible) return null;

  // Synced successfully — green flash
  if (showSuccess && isOnline && !syncing) {
    return (
      <div className="network-banner network-banner--success" id="network-status-banner">
        <div className="network-banner__inner">
          <CheckCircle2 size={16} className="network-banner__icon" />
          <span className="network-banner__text">All attendance synced successfully</span>
        </div>
      </div>
    );
  }

  // Currently syncing
  if (syncing) {
    return (
      <div className="network-banner network-banner--syncing" id="network-status-banner">
        <div className="network-banner__inner">
          <RefreshCw size={16} className="network-banner__icon network-banner__spin" />
          <span className="network-banner__text">
            Syncing {pendingCount} record{pendingCount !== 1 ? 's' : ''}...
          </span>
        </div>
      </div>
    );
  }

  // Offline
  if (!isOnline) {
    return (
      <div className="network-banner network-banner--offline" id="network-status-banner">
        <div className="network-banner__inner">
          <span className="network-banner__pulse" />
          <CloudOff size={16} className="network-banner__icon" />
          <span className="network-banner__text">
            You're offline
            {pendingCount > 0 && ` · ${pendingCount} pending`}
            {pendingCount === 0 && ' · Attendance will sync when reconnected'}
          </span>
        </div>
      </div>
    );
  }

  // Online with pending records (hasn't synced yet)
  if (pendingCount > 0) {
    return (
      <div className="network-banner network-banner--pending" id="network-status-banner">
        <div className="network-banner__inner">
          <RefreshCw size={16} className="network-banner__icon" />
          <span className="network-banner__text">
            {pendingCount} record{pendingCount !== 1 ? 's' : ''} waiting to sync
          </span>
        </div>
      </div>
    );
  }

  return null;
}
