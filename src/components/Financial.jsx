import { useEffect, useState } from 'react';
import { dataAPI } from '../lib/data';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import Swal from 'sweetalert2';
import { isOnline, syncAll, getPendingCount } from '../lib/sync';

ChartJS.register(ArcElement, Tooltip, Legend);

export default function Financial() {
  const [totalExp, setTotalExp] = useState(0);
  const [totalRev, setTotalRev] = useState(0);
  const [online, setOnline] = useState(isOnline());
  const [syncing, setSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const handleOnline = () => { setOnline(true); refreshPending(); };
    const handleOffline = () => { setOnline(false); refreshPending(); };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    refreshPending();
    const poll = setInterval(refreshPending, 5000);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(poll);
    };
  }, []);

  async function refreshPending() {
    try { setPendingCount(await getPendingCount()); } catch (e) { /* ignore */ }
  }

  useEffect(() => { loadData(); }, []);

  async function handleSync() {
    setSyncing(true);
    try {
      await syncAll();
      await loadData();
      Swal.fire('Synced', 'Financial transactions synchronized successfully.', 'success');
    } catch (err) {
      Swal.fire('Sync Failed', err.message, 'error');
    } finally {
      setSyncing(false);
    }
  }

  async function loadData() {
    const data = await dataAPI.financial_transactions.getAll();
    const exp = data?.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0) || 0;
    const rev = data?.filter(t => t.type === 'revenue').reduce((s, t) => s + t.amount, 0) || 0;
    setTotalExp(exp);
    setTotalRev(rev);
  }

  // ─── Improved: One‑column Add Transaction form ───
  async function addTransaction() {
    const { value: formValues } = await Swal.fire({
      title: 'Add Transaction',
      html: `
        <style>
          .tx-form {
            text-align: left;
            max-width: 400px;
            margin: 0 auto;
          }
          .tx-form .field {
            margin-bottom: 16px;
          }
          .tx-form .field label {
            display: block;
            font-weight: 600;
            color: #374151;
            font-size: 14px;
            margin-bottom: 4px;
          }
          .tx-form .field label i {
            margin-right: 6px;
            color: #6b7280;
          }
          .tx-form .field label .required {
            color: #ef4444;
            margin-left: 2px;
          }
          .tx-form .field input,
          .tx-form .field select,
          .tx-form .field textarea {
            width: 100%;
            padding: 10px 12px;
            border: 1px solid #d1d5db;
            border-radius: 8px;
            font-size: 14px;
            background: white;
            transition: border 0.2s, box-shadow 0.2s;
          }
          .tx-form .field input:focus,
          .tx-form .field select:focus,
          .tx-form .field textarea:focus {
            outline: none;
            border-color: #10b981;
            box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.15);
          }
          .tx-form .field input::placeholder,
          .tx-form .field textarea::placeholder {
            color: #9ca3af;
          }
          .tx-form .field .hint {
            font-size: 12px;
            color: #6b7280;
            margin-top: 4px;
          }
        </style>
        <div class="tx-form">
          <div class="field">
            <label><i class="fas fa-tag"></i> Type <span class="required">*</span></label>
            <select id="tx-type">
              <option value="expense">Expense</option>
              <option value="revenue">Revenue</option>
            </select>
          </div>
          <div class="field">
            <label><i class="fas fa-folder"></i> Category <span class="required">*</span></label>
            <select id="tx-category">
              <option value="feed">Feed</option>
              <option value="veterinary">Veterinary</option>
              <option value="labor">Labor</option>
              <option value="utilities">Utilities</option>
              <option value="logistics">Logistics</option>
              <option value="sales">Sales</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div class="field">
            <label><i class="fas fa-peso-sign"></i> Amount (₱) <span class="required">*</span></label>
            <input id="tx-amount" type="number" step="0.01" min="0.01" placeholder="0.00" />
          </div>
          <div class="field">
            <label><i class="fas fa-calendar-day"></i> Date</label>
            <input id="tx-date" type="date" value="${new Date().toISOString().split('T')[0]}" />
          </div>
          <div class="field">
            <label><i class="fas fa-pencil-alt"></i> Description <span class="hint">(optional)</span></label>
            <textarea id="tx-description" rows="2" placeholder="Brief description…"></textarea>
          </div>
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Add Transaction',
      cancelButtonText: 'Cancel',
      preConfirm: () => {
        const type = document.getElementById('tx-type').value;
        const category = document.getElementById('tx-category').value;
        const amount = document.getElementById('tx-amount').value.trim();
        const date = document.getElementById('tx-date').value;
        const description = document.getElementById('tx-description').value.trim();

        if (!amount) {
          Swal.showValidationMessage('Please enter the amount.');
          return false;
        }
        const amountNum = parseFloat(amount);
        if (isNaN(amountNum) || amountNum <= 0) {
          Swal.showValidationMessage('Please enter a valid positive amount.');
          return false;
        }
        if (!date) {
          Swal.showValidationMessage('Please select a date.');
          return false;
        }

        return { type, category, amount: amountNum, date, description };
      }
    });

    if (!formValues) return;

    try {
      await dataAPI.financial_transactions.insert({
        type: formValues.type,
        amount: formValues.amount,
        category: formValues.category,
        description: formValues.description || '',
        date: formValues.date,
      });
      Swal.fire('Success', 'Transaction added', 'success');
      loadData();
    } catch (error) {
      Swal.fire('Error', error.message, 'error');
    }
  }

  const net = totalRev - totalExp;
  const chartData = {
    labels: ['Expenses', 'Revenue'],
    datasets: [{ data: [totalExp, totalRev], backgroundColor: ['#ef4444', '#10b981'] }]
  };

  return (
    <div className="card" style={{ maxWidth: 1000, margin: '0 auto' }}>
      {/* ─── Offline Banner ─── */}
      {!online && (
        <div style={{
          background: 'linear-gradient(135deg, #fef3c7, #fde68a)',
          border: '1px solid #f59e0b', borderRadius: 14,
          padding: '12px 16px', marginBottom: 20,
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        }}>
          <i className="fas fa-wifi-slash" style={{ color: '#b45309', fontSize: 20 }}></i>
          <div style={{ flex: 1 }}>
            <strong style={{ color: '#78350f' }}>Offline Mode</strong>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: '#92400e' }}>
              Changes are saved locally and will sync automatically when you reconnect.
            </p>
          </div>
          {pendingCount > 0 && (
            <span style={{ background: '#b45309', color: 'white', borderRadius: 999, padding: '4px 12px', fontSize: 13, fontWeight: 700 }}>
              <i className="fas fa-clock" style={{ marginRight: 6 }}></i>{pendingCount} action{pendingCount !== 1 ? 's' : ''} queued
            </span>
          )}
        </div>
      )}
      {online && pendingCount > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, #d1fae5, #a7f3d0)',
          border: '1px solid #10b981', borderRadius: 14,
          padding: '10px 16px', marginBottom: 20,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <i className="fas fa-sync-alt fa-spin" style={{ color: '#059669' }}></i>
          <span style={{ color: '#065f46', fontWeight: 600, fontSize: 14 }}>
            Syncing {pendingCount} offline action{pendingCount !== 1 ? 's' : ''} to the cloud...
          </span>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <h3 style={{ fontSize: 24, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
          <i className="fas fa-chart-pie" style={{ color: '#2563eb' }}></i> Financial Dashboard
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={addTransaction} className="btn-primary" style={{ background: '#2563eb', padding: '6px 16px', borderRadius: 8 }}>
            <i className="fas fa-plus-circle"></i> Add Transaction
          </button>
        </div>
      </div>

      {/* Summary Cards with Peso sign */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div style={{ background: '#fef2f2', padding: 16, borderRadius: 16, borderLeft: '4px solid #ef4444' }}>
          <div style={{ fontSize: 13, color: '#4b5563' }}>Total Expenses</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#b91c1c' }}>₱{totalExp.toFixed(2)}</div>
        </div>
        <div style={{ background: '#f0fdf4', padding: 16, borderRadius: 16, borderLeft: '4px solid #10b981' }}>
          <div style={{ fontSize: 13, color: '#4b5563' }}>Total Revenue</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#065f46' }}>₱{totalRev.toFixed(2)}</div>
        </div>
        <div style={{ background: '#eff6ff', padding: 16, borderRadius: 16, borderLeft: `4px solid ${net >= 0 ? '#3b82f6' : '#f59e0b'}` }}>
          <div style={{ fontSize: 13, color: '#4b5563' }}>Net Profit</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: net >= 0 ? '#1d4ed8' : '#d97706' }}>
            {net >= 0 ? '+' : ''}₱{net.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div style={{ maxWidth: 280, margin: '0 auto' }}>
        <Doughnut data={chartData} options={{ responsive: true, plugins: { legend: { position: 'bottom' } } }} />
      </div>

      <style>{`
        .btn-primary {
          background: #10b981;
          color: white;
          border: none;
          border-radius: 8px;
          padding: 8px 16px;
          cursor: pointer;
          font-weight: 500;
          transition: background 0.2s;
        }
        .btn-primary:hover {
          background: #059669;
        }
        .card {
          background: white;
          border-radius: 16px;
          padding: 24px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        @media (max-width: 600px) {
          .card { padding: 16px; }
          .summary-card { padding: 12px; }
          .summary-card .amount { font-size: 22px; }
        }
      `}</style>
    </div>
  );
}