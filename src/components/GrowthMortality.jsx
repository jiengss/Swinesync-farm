import { useEffect, useState } from 'react';
import { dataAPI } from '../lib/data';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import Swal from 'sweetalert2';
import { isOnline, syncAll } from '../lib/sync';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function GrowthMortality() {
  const [growth, setGrowth] = useState([]);
  const [mortality, setMortality] = useState([]);
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

  useEffect(() => { loadData(); }, []);

  async function handleSync() {
    setSyncing(true);
    try {
      await syncAll();
      await loadData();
      Swal.fire('Synced', 'Growth & Mortality records synchronized successfully.', 'success');
    } catch (err) {
      Swal.fire('Sync Failed', err.message, 'error');
    } finally {
      setSyncing(false);
    }
  }

  async function loadData() {
    const growthData = await dataAPI.growth_records.getAll();
    const mortalityData = await dataAPI.mortality_records.getAll();
    setGrowth(growthData || []);
    setMortality(mortalityData || []);
  }

  async function addMortality() {
    const { value: cause } = await Swal.fire({
      title: 'Cause of death',
      input: 'text',
      inputPlaceholder: 'e.g., Disease, Injury',
      showCancelButton: true,
    });
    if (!cause) return;

    const { value: pigId } = await Swal.fire({
      title: 'Pig ID',
      input: 'text',
      inputPlaceholder: 'Enter pig ID',
      showCancelButton: true,
    });
    if (!pigId) return;

    try {
      await dataAPI.mortality_records.insert({ cause, date: new Date().toISOString().split('T')[0], pig_id: pigId });
      Swal.fire('Success', 'Mortality record added', 'success');
      loadData();
    } catch (error) {
      Swal.fire('Error', error.message, 'error');
    }
  }

  async function addWeight() {
    const { value: pigId } = await Swal.fire({
      title: 'Pig ID',
      input: 'text',
      inputPlaceholder: 'Enter pig ID',
      showCancelButton: true,
    });
    if (!pigId) return;

    const { value: weight } = await Swal.fire({
      title: 'Weight (kg)',
      input: 'number',
      inputPlaceholder: 'Enter weight',
      inputAttributes: { step: '0.1', min: '0' },
      showCancelButton: true,
    });
    if (weight === undefined || isNaN(parseFloat(weight)) || parseFloat(weight) <= 0) {
      Swal.fire('Invalid', 'Please enter a valid weight.', 'error');
      return;
    }

    try {
      await dataAPI.growth_records.insert({ pig_id: pigId, date: new Date().toISOString().split('T')[0], weight_kg: parseFloat(weight), gain: 0 });
      Swal.fire('Success', 'Weight recorded', 'success');
      loadData();
    } catch (error) {
      Swal.fire('Error', error.message, 'error');
    }
  }

  const chartData = {
    labels: growth.map(g => g.date),
    datasets: [{ label: 'Weight (kg)', data: growth.map(g => g.weight_kg), backgroundColor: '#34d399' }]
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <h3 style={{ fontSize: 24, fontWeight: 'bold', margin: 0 }}>🐖 Growth Performance</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 14, color: online ? '#10b981' : '#ef4444', fontWeight: 600 }}>
            <i className={`fas fa-${online ? 'wifi' : 'signal-slash'}`} style={{ marginRight: 6 }}></i>
            {online ? 'Online' : 'Offline'}
          </span>
          <button onClick={handleSync} disabled={syncing} style={{ background: '#10b981', color: 'white', border: 'none', borderRadius: 999, padding: '6px 14px', cursor: syncing ? 'not-allowed' : 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6, opacity: syncing ? 0.7 : 1 }}>
            <i className={`fas ${syncing ? 'fa-spinner fa-spin' : 'fa-sync-alt'}`}></i>
            {syncing ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>
      </div>
      <Bar data={chartData} height={120} />
      <h4 style={{ fontWeight: 'bold', marginTop: 24 }}>⚠️ Mortality Logs</h4>
      <ul style={{ listStyle: 'none' }}>
        {mortality.map(m => <li key={m.id} style={{ borderLeft: '4px solid #f87171', paddingLeft: 12, marginTop: 8 }}>{m.cause} - {m.date}</li>)}
        {mortality.length === 0 && <li style={{ color: '#9ca3af' }}>No mortality events recorded</li>}
      </ul>
      <button onClick={addMortality} className="btn-danger" style={{ marginTop: 16 }}>+ Record Mortality</button>
      <button onClick={addWeight} className="btn-secondary" style={{ marginLeft: 12 }}>+ Record Weight</button>
    </div>
  );
}