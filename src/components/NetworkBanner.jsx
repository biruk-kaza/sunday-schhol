import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw, CheckCircle2, CloudOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { syncOfflineRecords } from '../lib/syncEngine';

export default function NetworkBanner() {
  const { isOnline, syncing, pendingCount, lastResult } = useOnlineStatus();
  const [showSuccess, setShowSuccess] = useState(false);
  const [visible, setVisible]         = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!isOnline || pendingCount > 0 || syncing) {
      setVisible(true);
      setShowSuccess(false);
    } else if (lastResult === 'success') {
      setShowSuccess(true);
      setVisible(true);
      setErrorMessage('');
      const t = setTimeout(() => { setVisible(false); setShowSuccess(false); }, 3000);
      return () => clearTimeout(t);
    } else {
      if (!errorMessage) setVisible(false);
    }
  }, [isOnline, syncing, pendingCount, lastResult, errorMessage]);

  useEffect(() => {
    const onErr = (e) => {
      setErrorMessage(e.detail);
      setVisible(true);
      setTimeout(() => setErrorMessage(''), 6000);
    };
    window.addEventListener('sync-error', onErr);
    return () => window.removeEventListener('sync-error', onErr);
  }, []);

  if (!visible) return null;

  // ── Synced successfully ───────────────────────────────────────────────────
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

  // ── Actively syncing ──────────────────────────────────────────────────────
  if (syncing) {
    return (
      <div className="network-banner network-banner--syncing" id="network-status-banner">
        <div className="network-banner__inner">
          <RefreshCw size={16} className="network-banner__icon network-banner__spin" />
          <span className="network-banner__text">
            Syncing {pendingCount} record{pendingCount !== 1 ? 's' : ''}…
          </span>
        </div>
      </div>
    );
  }

  // ── Sync error ────────────────────────────────────────────────────────────
  if (errorMessage) {
    return (
      <div className="network-banner network-banner--offline" id="network-status-banner">
        <div className="network-banner__inner">
          <CloudOff size={16} className="network-banner__icon" style={{ color: '#ef4444' }} />
          <span className="network-banner__text" style={{ color: '#ef4444', fontWeight: 'bold' }}>
            {errorMessage}
          </span>
        </div>
      </div>
    );
  }

  // ── Offline ───────────────────────────────────────────────────────────────
  if (!isOnline) {
    return (
      <div className="network-banner network-banner--offline" id="network-status-banner">
        <div className="network-banner__inner">
          <span className="network-banner__pulse" />
          <CloudOff size={16} className="network-banner__icon" />
          <span className="network-banner__text">
            Offline
            {pendingCount > 0 && ` · ${pendingCount} record${pendingCount !== 1 ? 's' : ''} queued`}
            {pendingCount === 0 && ' · Attendance saves locally and syncs when reconnected'}
          </span>
        </div>
      </div>
    );
  }

  // ── Online but pending records ────────────────────────────────────────────
  if (pendingCount > 0) {
    return (
      <div className="network-banner network-banner--pending" id="network-status-banner">
        <div className="network-banner__inner" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <RefreshCw size={16} className="network-banner__icon" />
            <span className="network-banner__text">
              {pendingCount} record{pendingCount !== 1 ? 's' : ''} waiting to sync
            </span>
          </div>
          <button
            onClick={() => syncOfflineRecords()}
            disabled={syncing}
            style={{
              background: 'rgba(255,255,255,0.15)',
              border: '1px solid rgba(255,255,255,0.25)',
              color: '#fff',
              borderRadius: '6px',
              padding: '2px 10px',
              fontSize: '0.72rem',
              fontWeight: 800,
              cursor: 'pointer',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap'
            }}
          >
            Sync Now
          </button>
        </div>
      </div>
    );
  }

  return null;
}
