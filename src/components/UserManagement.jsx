import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { dataAPI } from '../lib/data';
import Swal from 'sweetalert2';

import { isOnline } from '../lib/sync';

export default function UserManagement({ profile }) {
  const [users, setUsers] = useState([]);
  const [newEmail, setNewEmail] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('Farm Caretaker');
  const [loading, setLoading] = useState(false);
  const [online, setOnline] = useState(isOnline());

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

  useEffect(() => { loadUsers(); }, []);

  async function loadUsers() {
    const data = await dataAPI.profiles.getAll();
    setUsers(data || []);
  }

  async function createUser() {
    if (!newEmail || !newPassword || !newUsername) {
      Swal.fire('Error', 'Please fill all fields', 'error');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({ email: newEmail, password: newPassword });
      if (error) throw error;
      if (data.user) {
        await dataAPI.profiles.insert({ id: data.user.id, username: newUsername, role: newRole });
        await loadUsers();
        setNewEmail(''); setNewUsername(''); setNewPassword('');
        Swal.fire('Success', 'User created successfully', 'success');
      }
    } catch (error) {
      Swal.fire('Error', error.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function updateRole(userId, role) {
    await dataAPI.profiles.update(userId, { role });
    await loadUsers();
    Swal.fire('Success', 'Role updated', 'success');
  }

  async function deleteUser(userId) {
    const result = await Swal.fire({
      title: 'Delete user?',
      text: 'This action cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      confirmButtonText: 'Delete',
    });
    if (result.isConfirmed) {
      try {
        await dataAPI.profiles.delete(userId);
        Swal.fire('Deleted', 'User removed', 'success');
        await loadUsers();
      } catch (error) {
        Swal.fire('Error', error.message, 'error');
      }
    }
  }

  const isAdmin = profile?.role?.toLowerCase() === 'admin';
  if (!profile || !isAdmin) {
    return (
      <div className="card">
        <p style={{ color: '#dc2626' }}><i className="fas fa-lock" style={{ marginRight: 8 }}></i> Access denied. Admin only.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <h3 style={{ fontSize: 24, fontWeight: 'bold', margin: 0 }}><i className="fas fa-shield-alt"></i> Role Management</h3>
        <span style={{ fontSize: 14, color: online ? '#10b981' : '#ef4444', fontWeight: 600 }}>
          <i className={`fas fa-${online ? 'wifi' : 'signal-slash'}`} style={{ marginRight: 6 }}></i>
          {online ? 'Online' : 'Offline'}
        </span>
      </div>
      
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead style={{ background: '#f9fafb' }}>
          <tr><th style={{ padding: 12, textAlign: 'left' }}>Username</th><th>Role</th><th>Actions</th></tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
              <td style={{ padding: 8 }}>{u.username}</td>
              <td>
                <select value={u.role} onChange={e => updateRole(u.id, e.target.value)} style={{ padding: '4px 8px', borderRadius: 8, border: '1px solid #d1d5db' }}>
                  <option>Admin</option><option>Owner</option><option>Farm Caretaker</option>
                </select>
              </td>
              <td><button onClick={() => deleteUser(u.id)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}><i className="fas fa-trash"></i></button></td>
            </tr>
          ))}
          {users.length === 0 && <tr><td colSpan="3" style={{ textAlign: 'center', padding: 16, color: '#6b7280' }}>No users found.</td></tr>}
        </tbody>
      </table>

      <div style={{ marginTop: 24, padding: 16, background: '#f9fafb', borderRadius: 16 }}>
        <h4 style={{ fontWeight: 'bold', marginBottom: 12 }}>Create New User</h4>
        
        {!online && (
          <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', padding: '10px 16px', borderRadius: 12, color: '#b91c1c', fontSize: 13, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="fas fa-exclamation-triangle"></i>
            <span>Creating users requires an internet connection to sync auth credentials.</span>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <input placeholder="Email" value={newEmail} onChange={e => setNewEmail(e.target.value)} disabled={!online} style={{ padding: 8, border: '1px solid #d1d5db', borderRadius: 8, opacity: online ? 1 : 0.6 }} />
          <input placeholder="Username" value={newUsername} onChange={e => setNewUsername(e.target.value)} disabled={!online} style={{ padding: 8, border: '1px solid #d1d5db', borderRadius: 8, opacity: online ? 1 : 0.6 }} />
          <input placeholder="Password" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} disabled={!online} style={{ padding: 8, border: '1px solid #d1d5db', borderRadius: 8, opacity: online ? 1 : 0.6 }} />
          <select value={newRole} onChange={e => setNewRole(e.target.value)} disabled={!online} style={{ padding: 8, border: '1px solid #d1d5db', borderRadius: 8, opacity: online ? 1 : 0.6 }}>
            <option>Farm Caretaker</option><option>Owner</option><option>Admin</option>
          </select>
        </div>
        <button onClick={createUser} className="btn-primary" style={{ marginTop: 16 }} disabled={loading || !online}>{loading ? 'Creating...' : 'Create User'}</button>
      </div>
    </div>
  );
}