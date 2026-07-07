import { useEffect, useState } from 'react';
import { dataAPI } from '../lib/data';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import Swal from 'sweetalert2';
import { isOnline, syncAll } from '../lib/sync';
import { addNotification as pushOwnerNotification } from '../lib/notifications';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function GrowthMortality({ profile }) {
  const [growth, setGrowth] = useState([]);
  const [mortality, setMortality] = useState([]);
  const [pigs, setPigs] = useState([]);
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
    const pigsData = await dataAPI.pigs.getAll();
    setGrowth(growthData || []);
    setMortality(mortalityData || []);
    setPigs(pigsData || []);
  }

  async function addMortality() {
    const pigOptions = pigs.map(p => `<option value="${p.id}">${p.tag} - ${p.name || ''}</option>`).join('');

    const { value: formValues } = await Swal.fire({
      title: 'Record Mortality',
      html:
        '<div style="display: flex; flex-direction: column; gap: 1rem;">' +
        `<select id="swal-pig-id" class="swal2-select" style="margin: 0; width: 100%; max-width: 100%; box-sizing: border-box;">
          <option value="" disabled selected>Select Pig</option>
          ${pigOptions}
        </select>` +
        '<select id="swal-cause" class="swal2-select" style="margin: 0; width: 100%; max-width: 100%; box-sizing: border-box;">' +
        '<option value="" disabled selected>Select cause of death</option>' +
        '<option value="Disease">Disease</option>' +
        '<option value="Injury">Injury</option>' +
        '<option value="Old Age">Old Age</option>' +
        '<option value="Unknown">Unknown</option>' +
        '<option value="Other">Other</option>' +
        '</select>' +
        '</div>',
      focusConfirm: false,
      showCancelButton: true,
      preConfirm: () => {
        const pigId = document.getElementById('swal-pig-id').value;
        const cause = document.getElementById('swal-cause').value;
        if (!pigId || !cause) {
          Swal.showValidationMessage('Please fill out all fields');
          return false;
        }
        return { pigId, cause };
      }
    });
    
    if (!formValues) return;
    const { pigId, cause } = formValues;

    try {
      await dataAPI.mortality_records.insert({ cause, date: new Date().toISOString().split('T')[0], pig_id: pigId });

      // Notify the farm owner about the mortality event
      const actorName = profile?.username || 'Caretaker';
      const pig = pigs.find(p => p.id === pigId);
      const pigDisplay = pig ? pig.tag : pigId;
      await pushOwnerNotification(
        'mortality_recorded',
        `${actorName} recorded a mortality event for pig ${pigDisplay}. Cause: ${cause}.`,
        'Owner',
        actorName
      );

      Swal.fire('Success', 'Mortality record added', 'success');
      loadData();
    } catch (error) {
      Swal.fire('Error', error.message, 'error');
    }
  }

  async function addWeight() {
    const pigOptions = pigs.map(p => `<option value="${p.id}">${p.tag} - ${p.name || ''}</option>`).join('');

    const { value: formValues } = await Swal.fire({
      title: 'Record Weight',
      html:
        '<div style="display: flex; flex-direction: column; gap: 1rem;">' +
        `<select id="swal-pig-id" class="swal2-select" style="margin: 0; width: 100%; max-width: 100%; box-sizing: border-box;">
          <option value="" disabled selected>Select Pig</option>
          ${pigOptions}
        </select>` +
        '<input id="swal-weight" type="number" step="0.1" min="0" class="swal2-input" placeholder="Weight (kg)" style="margin: 0;">' +
        '</div>',
      focusConfirm: false,
      showCancelButton: true,
      preConfirm: () => {
        const pigId = document.getElementById('swal-pig-id').value;
        const weight = document.getElementById('swal-weight').value;
        if (!pigId || !weight || isNaN(parseFloat(weight)) || parseFloat(weight) <= 0) {
          Swal.showValidationMessage('Please enter a valid Pig ID and weight');
          return false;
        }
        return { pigId, weight };
      }
    });

    if (!formValues) return;
    const { pigId, weight } = formValues;

    try {
      const weightKg = parseFloat(weight);
      await dataAPI.growth_records.insert({ pig_id: pigId, date: new Date().toISOString().split('T')[0], weight_kg: weightKg, gain: 0 });

      // Notify the farm owner about the growth record
      const actorName = profile?.username || 'Caretaker';
      const pig = pigs.find(p => p.id === pigId);
      const pigDisplay = pig ? pig.tag : pigId;
      await pushOwnerNotification(
        'growth_recorded',
        `${actorName} recorded weight for pig ${pigDisplay}: ${weightKg} kg.`,
        'Owner',
        actorName
      );

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