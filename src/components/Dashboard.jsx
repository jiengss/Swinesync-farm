import { useEffect, useState } from 'react';
import { dataAPI } from '../lib/data';
import Swal from 'sweetalert2';
import { isOnline, syncAll } from '../lib/sync';

export default function Dashboard({ onNavigateToModule }) {
  const [stats, setStats] = useState({
    pigCount: 0,
    feedStock: 0,
    netProfit: 0,
    upcomingEvents: 0,
  });
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [upcomingFarrowings, setUpcomingFarrowings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [realDailyConsumption, setRealDailyConsumption] = useState(0);

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    setLoading(true);
    try {
      const allPigs = await dataAPI.pigs.getAll();
      const pigCount = allPigs.length;
      const inventoryList = await dataAPI.inventory.getAll();
      const inventory = inventoryList && inventoryList.length > 0 ? inventoryList[0] : null;
      const transactions = await dataAPI.financial_transactions.getAll();
      const today = new Date().toISOString().split('T')[0];
      const allBreedings = await dataAPI.breedings.getAll();
      const upcomingBreedings = allBreedings.filter(b => b.expected_farrow >= today);
      const upcoming = upcomingBreedings.length;
      const totalExp = transactions?.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0) || 0;
      const totalRev = transactions?.filter(t => t.type === 'revenue').reduce((s, t) => s + t.amount, 0) || 0;

      setStats({
        pigCount: pigCount || 0,
        feedStock: inventory?.feed_stock_kg || 0,
        netProfit: totalRev - totalExp,
        upcomingEvents: upcoming || 0,
      });

      const recent = await dataAPI.financial_transactions.getAll({
        orderBy: { column: 'date', ascending: false },
        limit: 5
      });
      setRecentTransactions(recent || []);

      let farrowings = await dataAPI.breedings.getAll({
        filters: { expected_farrow: { gte: today } },
        orderBy: { column: 'expected_farrow', ascending: true },
        limit: 5
      });
      farrowings = farrowings.map(f => ({ ...f, pigs: allPigs.find(p => p.id === f.pig_id) }));
      setUpcomingFarrowings(farrowings || []);

      await loadRealConsumption();
      setLastUpdated(new Date());
    } catch (error) {
      Swal.fire('Error', 'Failed to load dashboard data', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function loadRealConsumption() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];
    const logs = await dataAPI.feeding_logs.getAll({
      filters: { time: { gte: thirtyDaysAgoStr } }
    });
    if (!logs || logs.length === 0) {
      setRealDailyConsumption(0);
      return;
    }
    const dailyMap = new Map();
    logs.forEach((log) => {
      const day = log.time.split('T')[0];
      dailyMap.set(day, (dailyMap.get(day) || 0) + log.amount_kg);
    });
    const totalConsumption = Array.from(dailyMap.values()).reduce((s, v) => s + v, 0);
    const daysWithData = dailyMap.size;
    const avgDaily = daysWithData > 0 ? totalConsumption / daysWithData : 0;
    setRealDailyConsumption(Math.round(avgDaily * 10) / 10);
  }

  const [online, setOnline] = useState(isOnline());
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  async function handleSync() {
    setSyncing(true);
    try {
      await syncAll();
      await loadDashboardData();
      Swal.fire('Synced', 'All pending data has been uploaded', 'success');
    } catch (err) {
      Swal.fire('Sync Failed', err.message, 'error');
    } finally {
      setSyncing(false);
    }
  }

  function refreshData() {
    loadDashboardData();
    Swal.fire('Refreshed', 'Dashboard data updated', 'success');
  }

  function daysUntil(dateString) {
    const diff = new Date(dateString) - new Date();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  const realDaysLeft = realDailyConsumption > 0 ? Math.floor(stats.feedStock / realDailyConsumption) : 0;
  const stockPercent = Math.min(100, Math.round((stats.feedStock / (stats.feedStock + 500)) * 100));
  const isLowFeed = stats.feedStock < 500;

  if (loading) return <div className="card" style={{ textAlign: 'center', padding: 48 }}><i className="fas fa-spinner fa-pulse fa-2x"></i><p>Loading dashboard...</p></div>;

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 16px' }}>
      {/* Header Controls */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '16px',
      }}>
        <span style={{ fontSize: 14, color: online ? '#10b981' : '#ef4444', fontWeight: 600 }}>
          <i className={`fas fa-${online ? 'wifi' : 'signal-slash'}`} style={{ marginRight: 6 }}></i>
          {online ? 'Online' : 'Offline'}
        </span>
        <button onClick={handleSync} disabled={syncing} style={{
          background: '#10b981',
          color: 'white',
          border: 'none',
          borderRadius: 8,
          padding: '6px 14px',
          cursor: syncing ? 'not-allowed' : 'pointer',
          fontSize: 14,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          opacity: syncing ? 0.7 : 1
        }}>
          <i className={`fas ${syncing ? 'fa-spinner fa-spin' : 'fa-sync-alt'}`}></i>
          {syncing ? 'Syncing...' : 'Sync Now'}
        </button>
        <span style={{ fontSize: 12, color: '#6b7280' }}>Last updated: {lastUpdated.toLocaleTimeString()}</span>
        <button onClick={refreshData} style={{
          background: '#e5e7eb',
          border: 'none',
          borderRadius: 8,
          padding: '4px 12px',
          cursor: 'pointer'
        }}>
          <i className="fas fa-sync-alt"></i> Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '20px',
        marginBottom: '32px'
      }}>
        <div className="card">
          <i className="fas fa-piggy-bank" style={{ fontSize: 32, color: '#10b981' }}></i>
          <p style={{ fontSize: 36, fontWeight: 900, marginTop: 8 }}>{stats.pigCount}</p>
          <p style={{ color: '#6b7280' }}>Active Pigs</p>
        </div>
        <div className="card">
          <i className="fas fa-warehouse" style={{ fontSize: 32, color: '#f59e0b' }}></i>
          <p style={{ fontSize: 36, fontWeight: 900, marginTop: 8 }}>{stats.feedStock} kg</p>
          <p style={{ color: '#6b7280' }}>Feed Stock</p>
        </div>
        <div className="card">
          <i className="fas fa-chart-simple" style={{ fontSize: 32, color: '#22c55e' }}></i>
          <p style={{ fontSize: 36, fontWeight: 900, marginTop: 8 }}>₱{stats.netProfit.toLocaleString()}</p>
          <p style={{ color: '#6b7280' }}>Net Profit</p>
        </div>
        <div className="card">
          <i className="fas fa-bell" style={{ fontSize: 32, color: '#a855f7' }}></i>
          <p style={{ fontSize: 24, fontWeight: 900, marginTop: 8 }}>{stats.upcomingEvents}</p>
          <p style={{ fontSize: 14, color: '#6b7280' }}>Upcoming Farrowings</p>
        </div>
      </div>

      {/* Insights Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '24px',
        marginBottom: '32px'
      }}>
        {/* Smart Insights Card */}
        <div className="card" style={{ cursor: 'pointer' }} onClick={() => onNavigateToModule && onNavigateToModule('inventory')}>
          <h3 style={{ fontWeight: 'bold', fontSize: 20, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="fas fa-calendar-alt" style={{ color: '#059669' }}></i> Smart Insights
          </h3>
          {realDailyConsumption > 0 ? (
            <>
              <p>📈 AI predicts feed depletion in <strong>{Math.max(0, realDaysLeft)} days</strong>.</p>
              <div style={{ width: '100%', background: '#e5e7eb', borderRadius: 999, height: 10, marginTop: 8 }}>
                <div style={{ width: `${stockPercent}%`, background: isLowFeed ? '#ef4444' : '#059669', height: 10, borderRadius: 999 }}></div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 4 }}>
                <span>Stock level</span><span>{stockPercent}%</span>
              </div>
              {isLowFeed && <div style={{ marginTop: 12, background: '#fee2e2', padding: 8, borderRadius: 12, color: '#b91c1c', fontSize: 14 }}>⚠️ Low feed stock! Consider reordering soon.</div>}
            </>
          ) : (
            <p>📊 No consumption data yet – start logging feedings to get predictions.</p>
          )}
          <div style={{ marginTop: 12 }}><i className="fas fa-tasks"></i> Upcoming tasks: {stats.upcomingEvents} farrowings to monitor.</div>
          <button onClick={(e) => { e.stopPropagation(); if (onNavigateToModule) onNavigateToModule('inventory'); }} style={{ marginTop: 12, background: '#10b981', color: 'white', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}>
            <i className="fas fa-arrow-right"></i> Go to AI Inventory
          </button>
        </div>

        {/* Recent Transactions */}
        <div className="card">
          <h3 style={{ fontWeight: 'bold', fontSize: 20, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="fas fa-receipt" style={{ color: '#22c55e' }}></i> Recent Transactions
          </h3>
          {recentTransactions.length === 0 ? <p>No transactions yet.</p> : (
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {recentTransactions.map(tx => (
                <li key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #e5e7eb' }}>
                  <span>
                    {tx.description || (tx.type === 'expense' ? 'Expense' : 'Revenue')}
                    {tx.category && <small style={{ display: 'block', fontSize: 11, color: '#6b7280' }}>{tx.category}</small>}
                    <br /><small style={{ fontSize: 11, color: '#6b7280' }}>{tx.date}</small>
                  </span>
                  <span style={{ fontWeight: 'bold', color: tx.type === 'expense' ? '#ef4444' : '#10b981' }}>
                    {tx.type === 'expense' ? '-' : '+'}₱{tx.amount}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Upcoming Farrowings */}
        <div className="card">
          <h3 style={{ fontWeight: 'bold', fontSize: 20, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="fas fa-calendar-week" style={{ color: '#a855f7' }}></i> Upcoming Farrowings
          </h3>
          {upcomingFarrowings.length === 0 ? <p>No upcoming farrowings scheduled.</p> : (
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {upcomingFarrowings.map(f => {
                const pig = f.pigs;
                const days = daysUntil(f.expected_farrow);
                return (
                  <li key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #e5e7eb' }}>
                    <div><strong>{pig?.tag || '?'} - {pig?.name || 'Unknown'}</strong><div style={{ fontSize: 12, color: '#4b5563' }}>{f.expected_farrow} ({days > 0 ? `${days} days left` : 'overdue'})</div></div>
                    <span style={{ background: days <= 7 ? '#fef3c7' : '#e0e7ff', padding: '2px 8px', borderRadius: 999, fontSize: 12 }}>{f.status}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <style>{`
        .card {
          background: white;
          border-radius: 16px;
          padding: 20px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.08);
        }
        @media (max-width: 768px) {
          .card {
            padding: 16px;
          }
          .card p:first-of-type {
            font-size: 28px !important;
          }
          .card i {
            font-size: 24px !important;
          }
        }
        @media (max-width: 480px) {
          .card p:first-of-type {
            font-size: 24px !important;
          }
        }
      `}</style>
    </div>
  );
}