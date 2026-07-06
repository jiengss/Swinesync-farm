import { useEffect, useState, useRef } from 'react';
import { dataAPI } from '../lib/data';
import { syncAll, isOnline } from '../lib/sync';
import { addNotification as pushOwnerNotification } from '../lib/notifications';
import Swal from 'sweetalert2';

export default function Breeding({ profile }) {
  const [pigs, setPigs] = useState([]);
  const [breedings, setBreedings] = useState([]);
  const [activeTab, setActiveTab] = useState('herd'); // 'herd' | 'mating' | 'farrowing'

  // ---- Pig state ----
  const [showAddPigModal, setShowAddPigModal] = useState(false);
  const [editingPig, setEditingPig] = useState(null);
  const [pigFormData, setPigFormData] = useState({
    tag: '', name: '', birth_date: '', gender: 'male', breed: 'Landrace', status: 'active', reproductive_status: 'Open', weight_kg: ''
  });
  const [submittingPig, setSubmittingPig] = useState(false);

  // ---- Mating state ----
  const [showMatingForm, setShowMatingForm] = useState(false);
  const [editingMating, setEditingMating] = useState(null);
  const [matingForm, setMatingForm] = useState({ pig_id: '', mating_date: '', notes: '' });
  const [submittingMating, setSubmittingMating] = useState(false);
  const [updatingStatusId, setUpdatingStatusId] = useState(null);

  // ---- Farrowing state ----
  const [showFarrowModal, setShowFarrowModal] = useState(false);
  const [farrowBreeding, setFarrowBreeding] = useState(null);
  const [farrowForm, setFarrowForm] = useState({
    actual_farrow_date: new Date().toISOString().split('T')[0],
    litter_size: '',
    stillborn: 0,
    notes: '',
  });
  const [submittingFarrow, setSubmittingFarrow] = useState(false);

  // ---- Quick sow add (inside mating form) ----
  const [showQuickSow, setShowQuickSow] = useState(false);
  const [quickSow, setQuickSow] = useState({ tag: '', name: '', weight_kg: '' });
  const [addingQuickSow, setAddingQuickSow] = useState(false);

  // ---- Filters for Pig Herd ----
  const [filterTag, setFilterTag] = useState('');
  const [filterGender, setFilterGender] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterReproStatus, setFilterReproStatus] = useState('all');

  // ---- Online / Sync ----
  const [online, setOnline] = useState(isOnline());
  const [syncing, setSyncing] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const notificationTimeout = useRef(null);

  const addNotification = (message, type = 'info') => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, message, type }]);
    clearTimeout(notificationTimeout.current);
    notificationTimeout.current = setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };

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

  const handleSync = async () => {
    setSyncing(true);
    try {
      await syncAll();
      addNotification('✅ Sync completed successfully', 'info');
      await loadData();
    } catch (error) {
      addNotification('❌ Sync failed: ' + error.message, 'error');
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const pigsData = await dataAPI.pigs.getAll();
    const breedingData = await dataAPI.breedings.getAll();
    setPigs(pigsData || []);
    setBreedings(breedingData || []);
  }

  // ---- Helpers ----
  function calculateExpectedFarrow(matingDate) {
    if (!matingDate) return '';
    const date = new Date(matingDate);
    date.setDate(date.getDate() + 115);
    return date.toISOString().split('T')[0];
  }

  function daysUntil(dateString) {
    if (!dateString) return null;
    const diff = new Date(dateString) - new Date();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  function getPigInfo(pigId) {
    const pig = pigs.find(p => p.id === pigId);
    return pig ? `${pig.tag} - ${pig.name}` : pigId;
  }

  const sowOptions = pigs.filter(p => p.gender === 'female' && p.status === 'active');

  // ---- Pig CRUD ----
  const openAddPigModal = () => {
    setEditingPig(null);
    setPigFormData({
      tag: '', name: '', birth_date: '', gender: 'male', breed: 'Landrace', status: 'active', reproductive_status: 'Open', weight_kg: ''
    });
    setShowAddPigModal(true);
  };

  const openEditPigModal = (pig) => {
    setEditingPig(pig);
    setPigFormData({
      tag: pig.tag || '',
      name: pig.name || '',
      birth_date: pig.birth_date || '',
      gender: pig.gender || 'male',
      breed: pig.breed || 'Landrace',
      status: pig.status || 'active',
      reproductive_status: pig.reproductive_status || 'Open',
      weight_kg: pig.weight_kg || '',
    });
    setShowAddPigModal(true);
  };

  const handleSavePig = async (e) => {
    e.preventDefault();
    setSubmittingPig(true);
    try {
      if (!pigFormData.tag) throw new Error('Tag is required');
      const weight = pigFormData.weight_kg ? parseFloat(pigFormData.weight_kg) : null;
      if (pigFormData.weight_kg && isNaN(weight)) throw new Error('Weight must be a number');
      const payload = {
        ...pigFormData,
        weight_kg: weight,
        reproductive_status: pigFormData.gender === 'female' ? pigFormData.reproductive_status : null,
      };
      if (editingPig) {
        await dataAPI.pigs.update(editingPig.id, payload);
        Swal.fire('Success', 'Pig updated successfully' + (!online ? ' (will sync later)' : ''), 'success');
      } else {
        await dataAPI.pigs.insert(payload);
        // Notify the farm owner
        const actorName = profile?.username || 'Caretaker';
        await pushOwnerNotification(
          'pig_added',
          `${actorName} registered a new pig: Tag ${payload.tag}${payload.name ? ` (${payload.name})` : ''}, ${payload.gender}, ${payload.breed}.`,
          'Owner',
          actorName
        );
        Swal.fire('Success', 'Pig added successfully' + (!online ? ' (will sync later)' : ''), 'success');
      }
      await loadData();
      setShowAddPigModal(false);
      setEditingPig(null);
      setPigFormData({
        tag: '', name: '', birth_date: '', gender: 'male', breed: 'Landrace', status: 'active', reproductive_status: 'Open', weight_kg: ''
      });
    } catch (error) {
      Swal.fire('Error', 'Error: ' + error.message, 'error');
    } finally {
      setSubmittingPig(false);
    }
  };

  // ---- Mating CRUD ----
  const openMatingForm = (breeding = null) => {
    if (breeding) {
      setEditingMating(breeding);
      setMatingForm({
        pig_id: breeding.pig_id,
        mating_date: breeding.mating_date,
        notes: breeding.notes || '',
      });
    } else {
      setEditingMating(null);
      setMatingForm({ pig_id: '', mating_date: '', notes: '' });
    }
    setShowMatingForm(true);
  };

  const closeMatingForm = () => {
    setShowMatingForm(false);
    setEditingMating(null);
    setMatingForm({ pig_id: '', mating_date: '', notes: '' });
  };

  const handleMatingSubmit = async (e) => {
    e.preventDefault();
    if (!matingForm.pig_id || !matingForm.mating_date) {
      Swal.fire('Error', 'Please select a sow and enter a mating date.', 'error');
      return;
    }
    if (!editingMating) {
      const alreadyBred = breedings.some(
        (b) => b.pig_id === matingForm.pig_id && b.id !== editingMating?.id && (b.status === 'Scheduled' || b.status === 'Confirmed')
      );
      if (alreadyBred) {
        Swal.fire('Error', 'This sow already has an active breeding record.', 'error');
        return;
      }
    }

    setSubmittingMating(true);
    const expectedFarrow = calculateExpectedFarrow(matingForm.mating_date);
    try {
      if (editingMating) {
        await dataAPI.breedings.update(editingMating.id, {
          pig_id: matingForm.pig_id,
          mating_date: matingForm.mating_date,
          expected_farrow: expectedFarrow,
          notes: matingForm.notes || null,
        });
        Swal.fire('Success', 'Mating record updated successfully' + (!online ? ' (will sync later)' : ''), 'success');
      } else {
        await dataAPI.breedings.insert({
          pig_id: matingForm.pig_id,
          mating_date: matingForm.mating_date,
          expected_farrow: expectedFarrow,
          status: 'Scheduled',
          notes: matingForm.notes || null,
        });
        Swal.fire('Success', 'Mating record added successfully' + (!online ? ' (will sync later)' : ''), 'success');
      }
      closeMatingForm();
      await loadData();
    } catch (error) {
      Swal.fire('Error', 'Error: ' + error.message, 'error');
    } finally {
      setSubmittingMating(false);
    }
  };

  async function updateMatingStatus(id, newStatus) {
    setUpdatingStatusId(id);
    try {
      await dataAPI.breedings.update(id, { status: newStatus });
      await loadData();
      Swal.fire('Success', `Status updated to "${newStatus}"` + (!online ? ' (will sync later)' : ''), 'success');
    } catch (error) {
      Swal.fire('Error', 'Error updating status: ' + error.message, 'error');
    } finally {
      setUpdatingStatusId(null);
    }
  }

  async function deleteMating(id) {
    const result = await Swal.fire({
      title: 'Delete mating record?',
      text: 'This action cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      confirmButtonText: 'Delete',
    });
    if (result.isConfirmed) {
      try {
        await dataAPI.breedings.delete(id);
        Swal.fire('Deleted', 'Mating record deleted', 'success');
        loadData();
      } catch (error) {
        Swal.fire('Error', 'Error deleting record: ' + error.message, 'error');
      }
    }
  }

  // ---- Quick Sow (inside mating form) ----
  const handleQuickSow = async (e) => {
    e.preventDefault();
    if (!quickSow.tag) {
      Swal.fire('Error', 'Tag is required', 'error');
      return;
    }
    setAddingQuickSow(true);
    try {
      const payload = {
        tag: quickSow.tag,
        name: quickSow.name || null,
        gender: 'female',
        status: 'active',
        reproductive_status: 'Open',
        weight_kg: quickSow.weight_kg ? parseFloat(quickSow.weight_kg) : null,
      };
      const newPig = await dataAPI.pigs.insert(payload);
      await loadData();
      setMatingForm({ ...matingForm, pig_id: newPig.id });
      setQuickSow({ tag: '', name: '', weight_kg: '' });
      setShowQuickSow(false);
      // Notify owner about the new quick sow
      const actorName = profile?.username || 'Caretaker';
      await pushOwnerNotification(
        'pig_added',
        `${actorName} added a new sow: Tag ${payload.tag}${payload.name ? ` (${payload.name})` : ''}.`,
        'Owner',
        actorName
      );
      Swal.fire('Success', 'Sow added and selected for mating.', 'success');
    } catch (error) {
      Swal.fire('Error', 'Error adding sow: ' + error.message, 'error');
    } finally {
      setAddingQuickSow(false);
    }
  };

  // ---- Farrowing ----
  const openFarrowModal = (breeding) => {
    setFarrowBreeding(breeding);
    setFarrowForm({
      actual_farrow_date: new Date().toISOString().split('T')[0],
      litter_size: '',
      stillborn: 0,
      notes: '',
    });
    setShowFarrowModal(true);
  };

  const handleFarrowSubmit = async (e) => {
    e.preventDefault();
    const { actual_farrow_date, litter_size, stillborn, notes } = farrowForm;
    if (!actual_farrow_date) {
      Swal.fire('Error', 'Please select the actual farrow date.', 'error');
      return;
    }
    const litter = parseInt(litter_size);
    if (isNaN(litter) || litter < 0) {
      Swal.fire('Error', 'Please enter a valid litter size.', 'error');
      return;
    }
    const still = parseInt(stillborn) || 0;

    setSubmittingFarrow(true);
    try {
      await dataAPI.breedings.update(farrowBreeding.id, {
        status: 'Farrowed',
        actual_farrowing_date: actual_farrow_date,
        litter_size: litter,
        stillborn: still,
        notes: (farrowBreeding.notes || '') + (notes ? `\nFarrow notes: ${notes}` : ''),
      });

      const sow = pigs.find(p => p.id === farrowBreeding.pig_id);
      if (sow) {
        await dataAPI.pigs.update(sow.id, { reproductive_status: 'Lactating' });
      }

      Swal.fire('Success', 'Farrowing recorded successfully!', 'success');
      setShowFarrowModal(false);
      await loadData();
    } catch (error) {
      Swal.fire('Error', 'Failed to record farrowing: ' + error.message, 'error');
    } finally {
      setSubmittingFarrow(false);
    }
  };

  // ---- Computed lists for tabs ----
  const upcomingFarrowings = breedings.filter(b =>
    b.status !== 'Farrowed' && b.status !== 'Aborted' &&
    b.expected_farrow && new Date(b.expected_farrow) >= new Date()
  ).sort((a, b) => new Date(a.expected_farrow) - new Date(b.expected_farrow));

  const recentFarrowings = breedings.filter(b =>
    b.status === 'Farrowed'
  ).sort((a, b) => new Date(b.actual_farrowing_date) - new Date(a.actual_farrowing_date)).slice(0, 10);

  const farrowingsDueSoon = upcomingFarrowings.filter(b => {
    const days = daysUntil(b.expected_farrow);
    return days !== null && days >= 0 && days <= 7;
  });

  const statusColors = {
    Scheduled: '#fef3c7',
    Confirmed: '#d1fae5',
    Farrowed: '#bfdbfe',
    Aborted: '#fee2e2',
  };

  // ---- Filtered pigs ----
  const filteredPigs = pigs.filter(pig => {
    const matchTag = pig.tag.toLowerCase().includes(filterTag.toLowerCase()) ||
                      pig.name.toLowerCase().includes(filterTag.toLowerCase());
    const matchGender = filterGender === 'all' || pig.gender === filterGender;
    const matchStatus = filterStatus === 'all' || pig.status === filterStatus;
    const matchRepro = filterReproStatus === 'all' || pig.reproductive_status === filterReproStatus;
    return matchTag && matchGender && matchStatus && matchRepro;
  });

  const clearFilters = () => {
    setFilterTag('');
    setFilterGender('all');
    setFilterStatus('all');
    setFilterReproStatus('all');
  };

  return (
    <div className="card" style={{ padding: 24, position: 'relative' }}>
      {/* Notifications */}
      {notifications.length > 0 && (
        <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 400 }}>
          {notifications.map((n) => (
            <div key={n.id} style={{ background: n.type === 'error' ? '#fee2e2' : '#d1fae5', color: n.type === 'error' ? '#b91c1c' : '#065f46', padding: '12px 16px', borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', borderLeft: `4px solid ${n.type === 'error' ? '#ef4444' : '#10b981'}`, fontSize: 14, fontWeight: 500, animation: 'slideIn 0.3s ease-out' }}>
              <i className={`fas ${n.type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}`} style={{ marginRight: 8 }}></i> {n.message}
            </div>
          ))}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <h3 style={{ fontSize: 24, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 8 }}>
          <i className="fas fa-heart" style={{ color: '#ef4444' }}></i> Breeding & Farrowing Manager
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 500, background: 'white', padding: '4px 12px', borderRadius: 999, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <i className={`fas fa-${online ? 'wifi' : 'signal-slash'}`} style={{ color: online ? '#10b981' : '#ef4444' }}></i>
            {online ? 'Online' : 'Offline'}
          </span>
          <button onClick={handleSync} disabled={syncing} style={{ background: '#10b981', color: 'white', border: 'none', borderRadius: 999, padding: '6px 14px', cursor: syncing ? 'not-allowed' : 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6, opacity: syncing ? 0.7 : 1 }}>
            <i className={`fas ${syncing ? 'fa-spinner fa-spin' : 'fa-sync-alt'}`}></i>
            {syncing ? 'Syncing...' : 'Sync Now'}
          </button>
          <button onClick={openAddPigModal} className="btn-primary" style={{ background: '#10b981', padding: '6px 12px', fontSize: 14 }}>
            <i className="fas fa-plus"></i> Add Pig
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, borderBottom: '2px solid #e5e7eb' }}>
        <button
          className={`tab-btn ${activeTab === 'herd' ? 'active-tab' : ''}`}
          onClick={() => setActiveTab('herd')}
          style={{ padding: '8px 16px', background: activeTab === 'herd' ? '#10b981' : 'transparent', color: activeTab === 'herd' ? 'white' : '#4b5563', border: 'none', borderRadius: '8px 8px 0 0', cursor: 'pointer', fontWeight: 500, transition: 'all 0.2s' }}
        >
          <i className="fas fa-piggy-bank"></i> Pig Herd
        </button>
        <button
          className={`tab-btn ${activeTab === 'mating' ? 'active-tab' : ''}`}
          onClick={() => setActiveTab('mating')}
          style={{ padding: '8px 16px', background: activeTab === 'mating' ? '#10b981' : 'transparent', color: activeTab === 'mating' ? 'white' : '#4b5563', border: 'none', borderRadius: '8px 8px 0 0', cursor: 'pointer', fontWeight: 500, transition: 'all 0.2s' }}
        >
          <i className="fas fa-calendar-heart"></i> Mating Planner
        </button>
        <button
          className={`tab-btn ${activeTab === 'farrowing' ? 'active-tab' : ''}`}
          onClick={() => setActiveTab('farrowing')}
          style={{ padding: '8px 16px', background: activeTab === 'farrowing' ? '#10b981' : 'transparent', color: activeTab === 'farrowing' ? 'white' : '#4b5563', border: 'none', borderRadius: '8px 8px 0 0', cursor: 'pointer', fontWeight: 500, transition: 'all 0.2s' }}
        >
          <i className="fas fa-baby"></i> Farrowing Manager
          {farrowingsDueSoon.length > 0 && (
            <span style={{ marginLeft: 8, background: '#ef4444', color: 'white', borderRadius: 999, padding: '0 8px', fontSize: 12 }}>
              {farrowingsDueSoon.length}
            </span>
          )}
        </button>
      </div>

      {/* ===== TAB: PIG HERD ===== */}
      {activeTab === 'herd' && (
        <div>
          <p style={{ color: '#6b7280', marginBottom: 16, fontSize: 14 }}>
            <i className="fas fa-info-circle"></i> View and manage all pigs. Click <strong>Add Pig</strong> to register a new pig.
          </p>

          {/* Filter Bar */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16, alignItems: 'center', background: '#f9fafb', padding: 12, borderRadius: 8 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <input
                type="text"
                placeholder="Search tag or name..."
                value={filterTag}
                onChange={(e) => setFilterTag(e.target.value)}
                style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 14, minWidth: '150px' }}
              />
              <select value={filterGender} onChange={(e) => setFilterGender(e.target.value)} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 14 }}>
                <option value="all">All genders</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 14 }}>
                <option value="all">All status</option>
                <option value="active">Active</option>
                <option value="sold">Sold</option>
                <option value="deceased">Deceased</option>
              </select>
              <select value={filterReproStatus} onChange={(e) => setFilterReproStatus(e.target.value)} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 14 }}>
                <option value="all">All repro status</option>
                <option value="Open">Open</option>
                <option value="Pregnant">Pregnant</option>
                <option value="Lactating">Lactating</option>
                <option value="Dry">Dry</option>
              </select>
            </div>
            <button onClick={clearFilters} style={{ background: '#e5e7eb', border: 'none', padding: '6px 12px', borderRadius: 6, cursor: 'pointer' }}>
              <i className="fas fa-times"></i> Clear filters
            </button>
            <span style={{ fontSize: 14, color: '#4b5563', marginLeft: 'auto' }}>
              {filteredPigs.length} pig{filteredPigs.length !== 1 ? 's' : ''} found
            </span>
          </div>

          <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 12 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: '#f9fafb' }}>
                <tr>
                  <th style={{ padding: 12, textAlign: 'left', fontSize: 14, fontWeight: 600, color: '#4b5563' }}>Tag</th>
                  <th style={{ padding: 12, textAlign: 'left', fontSize: 14, fontWeight: 600, color: '#4b5563' }}>Name</th>
                  <th style={{ padding: 12, textAlign: 'left', fontSize: 14, fontWeight: 600, color: '#4b5563' }}>Repro Status</th>
                  <th style={{ padding: 12, textAlign: 'left', fontSize: 14, fontWeight: 600, color: '#4b5563' }}>Weight</th>
                  <th style={{ padding: 12, textAlign: 'center', fontSize: 14, fontWeight: 600, color: '#4b5563' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPigs.map((p) => (
                  <tr key={p.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: 8 }}>{p.tag}</td>
                    <td>{p.name}</td>
                    <td><span style={{ background: '#fce7f3', padding: '4px 10px', borderRadius: 999, fontSize: 12 }}>{p.reproductive_status}</span></td>
                    <td>{p.weight_kg} kg</td>
                    <td style={{ textAlign: 'center' }}>
                      <button onClick={() => openEditPigModal(p)} style={{ background: '#e0e7ff', border: 'none', padding: '4px 8px', borderRadius: 8, cursor: 'pointer' }} title="Edit pig">
                        <i className="fas fa-pen" style={{ color: '#2563eb' }}></i>
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredPigs.length === 0 && (
                  <tr><td colSpan="5" style={{ textAlign: 'center', padding: 24, color: '#6b7280' }}>
                    {pigs.length === 0 ? 'No pigs yet. Click "Add Pig" to start.' : 'No pigs match the current filters.'}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===== TAB: MATING PLANNER ===== */}
      {activeTab === 'mating' && (
        <div>
          <p style={{ color: '#6b7280', marginBottom: 16, fontSize: 14 }}>
            <i className="fas fa-info-circle"></i> Record matings to track breeding cycles. The expected farrow date is automatically calculated.
          </p>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h4 style={{ fontWeight: 'bold', fontSize: 18, color: '#374151' }}><i className="fas fa-list"></i> Mating Records</h4>
            <button onClick={() => openMatingForm()} className="btn-primary" style={{ background: '#a855f7' }}>
              <i className="fas fa-plus"></i> New Mating
            </button>
          </div>

          {showMatingForm && (
            <div style={{ background: '#f0fdf4', padding: 20, borderRadius: 16, marginBottom: 16, border: '1px solid #bbf7d0' }}>
              <h4 style={{ marginBottom: 12, fontSize: 16, fontWeight: 'bold' }}>{editingMating ? '✏️ Edit Mating' : '➕ Add New Mating'}</h4>
              <form onSubmit={handleMatingSubmit}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Select Sow <span style={{ color: '#ef4444' }}>*</span></label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <select value={matingForm.pig_id} onChange={(e) => setMatingForm({ ...matingForm, pig_id: e.target.value })} style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid #ccc' }} required>
                        <option value="">-- Choose a sow --</option>
                        {sowOptions.map((pig) => (
                          <option key={pig.id} value={pig.id}>{pig.tag} - {pig.name} ({pig.reproductive_status || 'Open'})</option>
                        ))}
                      </select>
                      <button type="button" onClick={() => setShowQuickSow(!showQuickSow)} style={{ background: '#3b82f6', color: 'white', border: 'none', borderRadius: 8, padding: '0 12px', cursor: 'pointer' }}>
                        <i className="fas fa-plus"></i> New Sow
                      </button>
                    </div>
                    {sowOptions.length === 0 && <small style={{ color: '#6b7280' }}>No active sows. Click "New Sow" to add one.</small>}
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Mating Date <span style={{ color: '#ef4444' }}>*</span></label>
                    <input type="date" value={matingForm.mating_date} onChange={(e) => setMatingForm({ ...matingForm, mating_date: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #ccc' }} required />
                  </div>
                </div>

                {showQuickSow && (
                  <div style={{ marginTop: 12, padding: 12, background: '#eff6ff', borderRadius: 12, border: '1px solid #bfdbfe' }}>
                    <h5 style={{ fontWeight: 'bold', marginBottom: 8 }}><i className="fas fa-piggy-bank"></i> Add New Sow</h5>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                      <input type="text" placeholder="Tag *" value={quickSow.tag} onChange={(e) => setQuickSow({ ...quickSow, tag: e.target.value })} style={{ padding: 8, borderRadius: 8, border: '1px solid #ccc' }} required />
                      <input type="text" placeholder="Name" value={quickSow.name} onChange={(e) => setQuickSow({ ...quickSow, name: e.target.value })} style={{ padding: 8, borderRadius: 8, border: '1px solid #ccc' }} />
                      <input type="number" step="0.1" placeholder="Weight (kg)" value={quickSow.weight_kg} onChange={(e) => setQuickSow({ ...quickSow, weight_kg: e.target.value })} style={{ padding: 8, borderRadius: 8, border: '1px solid #ccc' }} />
                    </div>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
                      <button type="button" onClick={() => setShowQuickSow(false)} style={{ background: '#9ca3af', padding: '4px 12px', borderRadius: 8, border: 'none', color: 'white' }}>Cancel</button>
                      <button type="button" onClick={handleQuickSow} disabled={addingQuickSow} style={{ background: '#10b981', padding: '4px 12px', borderRadius: 8, border: 'none', color: 'white', cursor: addingQuickSow ? 'not-allowed' : 'pointer' }}>
                        {addingQuickSow ? 'Adding...' : 'Add Sow'}
                      </button>
                    </div>
                  </div>
                )}

                {matingForm.mating_date && (
                  <div style={{ marginTop: 8, fontSize: 14, color: '#059669' }}>
                    <i className="fas fa-calendar-check"></i> Expected farrow: <strong>{calculateExpectedFarrow(matingForm.mating_date)}</strong> (115 days after mating)
                  </div>
                )}

                <div style={{ marginTop: 12 }}>
                  <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Notes (optional)</label>
                  <textarea value={matingForm.notes} onChange={(e) => setMatingForm({ ...matingForm, notes: e.target.value })} placeholder="e.g., Boar used, observations" rows={2} style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #ccc', resize: 'vertical' }} />
                </div>

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
                  <button type="button" onClick={closeMatingForm} style={{ background: '#9ca3af', padding: '6px 16px', borderRadius: 8, border: 'none', color: 'white' }} disabled={submittingMating}>Cancel</button>
                  <button type="submit" style={{ background: '#10b981', padding: '6px 16px', borderRadius: 8, border: 'none', color: 'white', cursor: submittingMating ? 'not-allowed' : 'pointer', opacity: submittingMating ? 0.7 : 1 }} disabled={submittingMating}>
                    {submittingMating ? 'Saving...' : editingMating ? 'Update' : 'Save'}
                  </button>
                </div>
              </form>
            </div>
          )}

          <div style={{ display: 'grid', gap: 12 }}>
            {breedings.map((b) => (
              <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f9fafb', padding: 12, borderRadius: 16, border: '1px solid #e5e7eb', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ flex: 2, minWidth: '200px' }}>
                  <div><strong>{getPigInfo(b.pig_id)}</strong></div>
                  <div style={{ fontSize: 14, color: '#4b5563' }}>
                    <i className="fas fa-calendar"></i> Mating: {b.mating_date} → Farrow: {b.expected_farrow}
                    {b.notes && <span style={{ marginLeft: 12, fontSize: 12, color: '#6b7280' }}><i className="fas fa-pencil-alt"></i> {b.notes}</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <button onClick={() => openMatingForm(b)} style={{ background: '#e0e7ff', border: 'none', padding: '4px 8px', borderRadius: 8, cursor: 'pointer' }} title="Edit">
                    <i className="fas fa-pen" style={{ color: '#2563eb' }}></i>
                  </button>
                  <select value={b.status} onChange={(e) => updateMatingStatus(b.id, e.target.value)} disabled={updatingStatusId === b.id} style={{ background: statusColors[b.status] || '#e5e7eb', padding: '4px 12px', borderRadius: 999, border: 'none', fontSize: 12, fontWeight: 500, cursor: updatingStatusId === b.id ? 'wait' : 'pointer', opacity: updatingStatusId === b.id ? 0.6 : 1 }}>
                    <option value="Scheduled">Scheduled</option>
                    <option value="Confirmed">Confirmed</option>
                    <option value="Farrowed">Farrowed</option>
                    <option value="Aborted">Aborted</option>
                  </select>
                  <button onClick={() => deleteMating(b.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 16 }} title="Delete">
                    <i className="fas fa-trash-alt"></i>
                  </button>
                </div>
              </div>
            ))}
            {breedings.length === 0 && !showMatingForm && (
              <div style={{ textAlign: 'center', color: '#6b7280', padding: 24, border: '1px dashed #d1d5db', borderRadius: 12 }}>
                No mating records yet. Click "New Mating" to start.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== TAB: FARROWING MANAGER ===== */}
      {activeTab === 'farrowing' && (
        <div>
          <p style={{ color: '#6b7280', marginBottom: 16, fontSize: 14 }}>
            <i className="fas fa-info-circle"></i> Monitor upcoming farrowings and record litter details once they occur.
          </p>

          {farrowingsDueSoon.length > 0 && (
            <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 16, padding: 16, marginBottom: 20 }}>
              <h4 style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 8 }}>
                <i className="fas fa-exclamation-triangle" style={{ color: '#d97706' }}></i>
                Due soon (next 7 days)
              </h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {farrowingsDueSoon.map(b => {
                  const days = daysUntil(b.expected_farrow);
                  const pig = pigs.find(p => p.id === b.pig_id);
                  return (
                    <li key={b.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #fde68a' }}>
                      <span><strong>{pig?.tag || '?'}</strong> – {pig?.name || 'Unknown'} (due in {days} day{days > 1 ? 's' : ''})</span>
                      <button onClick={() => openFarrowModal(b)} className="btn-primary" style={{ background: '#10b981', padding: '2px 12px', fontSize: 12 }}>
                        <i className="fas fa-check"></i> Record Farrow
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <h4 style={{ fontWeight: 'bold', fontSize: 18, marginBottom: 12 }}><i className="fas fa-clock"></i> Upcoming Farrowings</h4>
          {upcomingFarrowings.length === 0 ? (
            <p style={{ color: '#6b7280' }}>No upcoming farrowings scheduled.</p>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {upcomingFarrowings.map(b => {
                const pig = pigs.find(p => p.id === b.pig_id);
                const days = daysUntil(b.expected_farrow);
                return (
                  <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f9fafb', padding: 12, borderRadius: 16, border: '1px solid #e5e7eb', flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <strong>{pig?.tag || '?'} – {pig?.name || 'Unknown'}</strong>
                      <div style={{ fontSize: 14, color: '#4b5563' }}>
                        Expected: {b.expected_farrow} ({days > 0 ? `${days} days left` : 'overdue'})
                        {b.notes && <span style={{ marginLeft: 12, fontSize: 12, color: '#6b7280' }}><i className="fas fa-pencil-alt"></i> {b.notes}</span>}
                      </div>
                    </div>
                    <button onClick={() => openFarrowModal(b)} className="btn-primary" style={{ background: '#10b981' }}>
                      <i className="fas fa-check"></i> Record Farrow
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <h4 style={{ fontWeight: 'bold', fontSize: 18, marginTop: 24, marginBottom: 12 }}><i className="fas fa-history"></i> Recent Farrowings</h4>
          {recentFarrowings.length === 0 ? (
            <p style={{ color: '#6b7280' }}>No farrowings recorded yet.</p>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {recentFarrowings.map(b => {
                const pig = pigs.find(p => p.id === b.pig_id);
                return (
                  <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f9fafb', padding: 12, borderRadius: 16, border: '1px solid #e5e7eb', flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <strong>{pig?.tag || '?'} – {pig?.name || 'Unknown'}</strong>
                      <div style={{ fontSize: 14, color: '#4b5563' }}>
                        Farrowed: {b.actual_farrowing_date} · Litter: {b.litter_size} piglets (stillborn: {b.stillborn})
                        {b.notes && <span style={{ marginLeft: 12, fontSize: 12, color: '#6b7280' }}><i className="fas fa-pencil-alt"></i> {b.notes}</span>}
                      </div>
                    </div>
                    <span style={{ background: '#bfdbfe', padding: '4px 12px', borderRadius: 999, fontSize: 12 }}>{b.status}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ===== ADD/EDIT PIG MODAL ===== */}
      {showAddPigModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px', animation: 'fadeIn 0.3s ease' }} onClick={() => setShowAddPigModal(false)}>
          <div style={{ background: 'white', padding: '32px', borderRadius: '28px', width: '100%', maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)', position: 'relative' }} onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowAddPigModal(false)} style={{ position: 'absolute', top: '16px', right: '20px', background: 'none', border: 'none', fontSize: '24px', color: '#9ca3af', cursor: 'pointer', transition: 'color 0.2s' }} onMouseEnter={(e) => e.target.style.color = '#374151'} onMouseLeave={(e) => e.target.style.color = '#9ca3af'}>
              <i className="fas fa-times"></i>
            </button>
            <h3 style={{ marginBottom: '24px', fontSize: '26px', fontWeight: '700', color: '#1f2937', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <i className="fas fa-piggy-bank" style={{ color: '#10b981' }}></i>
              {editingPig ? '✏️ Edit Pig' : '➕ Add New Pig'}
            </h3>
            <form onSubmit={handleSavePig}>
              <div style={{ marginBottom: '24px' }}>
                <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#4b5563', marginBottom: '16px', borderBottom: '2px solid #e5e7eb', paddingBottom: '8px' }}>
                  <i className="fas fa-info-circle" style={{ marginRight: '8px', color: '#10b981' }}></i> Basic Information
                </h4>
                <div style={{ display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', fontSize: '14px', color: '#374151' }}><i className="fas fa-tag" style={{ marginRight: '6px', color: '#6b7280' }}></i> Tag <span style={{ color: '#ef4444' }}>*</span></label>
                    <input type="text" value={pigFormData.tag} onChange={(e) => setPigFormData({ ...pigFormData, tag: e.target.value })} required className="form-input" placeholder="e.g., P001" style={{ width: '100%' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', fontSize: '14px', color: '#374151' }}><i className="fas fa-pen" style={{ marginRight: '6px', color: '#6b7280' }}></i> Name</label>
                    <input type="text" value={pigFormData.name} onChange={(e) => setPigFormData({ ...pigFormData, name: e.target.value })} className="form-input" placeholder="e.g., Bella" style={{ width: '100%' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', fontSize: '14px', color: '#374151' }}><i className="fas fa-calendar-alt" style={{ marginRight: '6px', color: '#6b7280' }}></i> Birth Date</label>
                    <input type="date" value={pigFormData.birth_date} onChange={(e) => setPigFormData({ ...pigFormData, birth_date: e.target.value })} className="form-input" style={{ width: '100%' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', fontSize: '14px', color: '#374151' }}><i className="fas fa-venus-mars" style={{ marginRight: '6px', color: '#6b7280' }}></i> Gender <span style={{ color: '#ef4444' }}>*</span></label>
                    <select value={pigFormData.gender} onChange={(e) => setPigFormData({ ...pigFormData, gender: e.target.value, reproductive_status: e.target.value === 'female' ? 'Open' : '' })} className="form-input" style={{ width: '100%' }}>
                      <option value="male">Male</option><option value="female">Female</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', fontSize: '14px', color: '#374151' }}><i className="fas fa-dna" style={{ marginRight: '6px', color: '#6b7280' }}></i> Breed</label>
                    <select value={pigFormData.breed} onChange={(e) => setPigFormData({ ...pigFormData, breed: e.target.value })} className="form-input" style={{ width: '100%' }}>
                      <option value="Landrace">Landrace</option><option value="Large White">Large White</option><option value="Duroc">Duroc</option><option value="Berkshire">Berkshire</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', fontSize: '14px', color: '#374151' }}><i className="fas fa-circle" style={{ marginRight: '6px', color: '#6b7280' }}></i> Status</label>
                    <select value={pigFormData.status} onChange={(e) => setPigFormData({ ...pigFormData, status: e.target.value })} className="form-input" style={{ width: '100%' }}>
                      <option value="active">Active</option><option value="sold">Sold</option><option value="deceased">Deceased</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', fontSize: '14px', color: '#374151' }}><i className="fas fa-weight" style={{ marginRight: '6px', color: '#6b7280' }}></i> Weight (kg)</label>
                    <input type="number" step="0.1" value={pigFormData.weight_kg} onChange={(e) => setPigFormData({ ...pigFormData, weight_kg: e.target.value })} className="form-input" placeholder="e.g., 85.5" style={{ width: '100%' }} />
                  </div>
                </div>
              </div>
              {pigFormData.gender === 'female' && (
                <div style={{ marginBottom: '24px' }}>
                  <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#4b5563', marginBottom: '16px', borderBottom: '2px solid #e5e7eb', paddingBottom: '8px' }}>
                    <i className="fas fa-heartbeat" style={{ marginRight: '8px', color: '#ec4899' }}></i> Reproductive Status
                  </h4>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', fontSize: '14px', color: '#374151' }}><i className="fas fa-egg" style={{ marginRight: '6px', color: '#6b7280' }}></i> Status</label>
                    <select value={pigFormData.reproductive_status} onChange={(e) => setPigFormData({ ...pigFormData, reproductive_status: e.target.value })} className="form-input" style={{ width: '100%' }}>
                      <option value="Open">Open</option><option value="Pregnant">Pregnant</option><option value="Lactating">Lactating</option><option value="Dry">Dry</option>
                    </select>
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px', paddingTop: '16px', borderTop: '1px solid #e5e7eb' }}>
                <button type="button" onClick={() => setShowAddPigModal(false)} style={{ padding: '10px 24px', background: '#f3f4f6', border: 'none', borderRadius: '12px', color: '#4b5563', fontWeight: '600', cursor: 'pointer', transition: 'background 0.2s' }} onMouseEnter={(e) => e.target.style.background = '#e5e7eb'} onMouseLeave={(e) => e.target.style.background = '#f3f4f6'}>Cancel</button>
                <button type="submit" disabled={submittingPig} style={{ padding: '10px 32px', background: submittingPig ? '#9ca3af' : '#10b981', border: 'none', borderRadius: '12px', color: 'white', fontWeight: '600', cursor: submittingPig ? 'not-allowed' : 'pointer', opacity: submittingPig ? 0.7 : 1, transition: 'background 0.2s, transform 0.1s', boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)' }} onMouseEnter={(e) => { if (!submittingPig) e.target.style.background = '#059669'; }} onMouseLeave={(e) => { if (!submittingPig) e.target.style.background = '#10b981'; }}>
                  {submittingPig ? <><i className="fas fa-spinner fa-spin" style={{ marginRight: '8px' }}></i> Saving...</> : <><i className="fas fa-save" style={{ marginRight: '8px' }}></i> {editingPig ? 'Update Pig' : 'Add Pig'}</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== FARROW MODAL ===== */}
      {showFarrowModal && farrowBreeding && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }} onClick={() => setShowFarrowModal(false)}>
          <div style={{ background: 'white', padding: '32px', borderRadius: '28px', width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)', position: 'relative' }} onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowFarrowModal(false)} style={{ position: 'absolute', top: '16px', right: '20px', background: 'none', border: 'none', fontSize: '24px', color: '#9ca3af', cursor: 'pointer' }}><i className="fas fa-times"></i></button>
            <h3 style={{ marginBottom: '24px', fontSize: '24px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <i className="fas fa-baby" style={{ color: '#10b981' }}></i> Record Farrowing
            </h3>
            <p style={{ marginBottom: 16, fontSize: 14, color: '#4b5563' }}>
              Sow: <strong>{getPigInfo(farrowBreeding.pig_id)}</strong><br />
              Expected farrow: {farrowBreeding.expected_farrow}
            </p>
            <form onSubmit={handleFarrowSubmit}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Actual Farrow Date *</label>
                <input type="date" value={farrowForm.actual_farrow_date} onChange={(e) => setFarrowForm({ ...farrowForm, actual_farrow_date: e.target.value })} required style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #ccc' }} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Number of Piglets *</label>
                <input type="number" min="0" step="1" value={farrowForm.litter_size} onChange={(e) => setFarrowForm({ ...farrowForm, litter_size: e.target.value })} required placeholder="e.g., 10" style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #ccc' }} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Stillborn</label>
                <input type="number" min="0" step="1" value={farrowForm.stillborn} onChange={(e) => setFarrowForm({ ...farrowForm, stillborn: e.target.value })} placeholder="0" style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #ccc' }} />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Notes (optional)</label>
                <textarea rows={2} value={farrowForm.notes} onChange={(e) => setFarrowForm({ ...farrowForm, notes: e.target.value })} placeholder="Any observations or issues" style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #ccc', resize: 'vertical' }} />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowFarrowModal(false)} style={{ background: '#9ca3af', padding: '6px 16px', borderRadius: 8, border: 'none', color: 'white' }}>Cancel</button>
                <button type="submit" disabled={submittingFarrow} style={{ background: submittingFarrow ? '#9ca3af' : '#10b981', padding: '6px 16px', borderRadius: 8, border: 'none', color: 'white', cursor: submittingFarrow ? 'not-allowed' : 'pointer', opacity: submittingFarrow ? 0.7 : 1 }}>
                  {submittingFarrow ? 'Saving...' : 'Record Farrow'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideIn { from { opacity:0; transform:translateX(20px); } to { opacity:1; transform:translateX(0); } }
        @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
        .form-input { padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; transition: border-color 0.2s, box-shadow 0.2s; background: white; }
        .form-input:focus { outline: none; border-color: #10b981; box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.15); }
        .form-input::placeholder { color: #9ca3af; }
        .tab-btn:hover { background-color: #f3f4f6; }
        .active-tab { background: #10b981; color: white; }
        .active-tab:hover { background: #059669; }
        .btn-primary { background: #10b981; color: white; border: none; border-radius: 8px; padding: 8px 16px; cursor: pointer; font-weight: 500; transition: background 0.2s; }
        .btn-primary:hover { background: #059669; }
      `}</style>
    </div>
  );
}