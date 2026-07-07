import { useEffect, useState } from 'react';
import { getPendingCount, syncAll, isOnline } from '../lib/sync';
import Swal from 'sweetalert2';

export default function SyncStatus() {
  const [pending, setPending] = useState(0);
  const [online, setOnline] = useState(isOnline());

  useEffect(() => {
    const update = async () => {
      const count = await getPendingCount();
      setPending(count);
      setOnline(isOnline());
    };
    update();
    const interval = setInterval(update, 10000);

    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleSync = async () => {
    try {
      await syncAll();
      const count = await getPendingCount();
      setPending(count);
      Swal.fire('Sync complete', 'All pending changes have been synced.', 'success');
    } catch (error) {
      Swal.fire('Sync failed', error.message, 'error');
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 14 }}>
      <span>
        <i className={`fas fa-${online ? 'wifi' : 'exclamation-triangle'}`} style={{ color: online ? '#10b981' : '#ef4444' }}></i>
        {online ? ' Online' : ' Offline'}
      </span>
      {pending > 0 && (
        <span style={{ background: '#fef3c7', padding: '2px 10px', borderRadius: 999 }}>
          {pending} pending {pending === 1 ? 'change' : 'changes'}
        </span>
      )}
      <button onClick={handleSync} disabled={!online} className="btn-secondary" style={{ padding: '4px 12px', opacity: online ? 1 : 0.5, cursor: online ? 'pointer' : 'not-allowed' }}>
        <i className="fas fa-sync-alt"></i> Sync Now
      </button>
    </div>
  );
}