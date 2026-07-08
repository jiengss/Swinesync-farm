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
      <div className="card" style={{ textAlign: 'center', padding: 40 }}>
        <i className="fas fa-lock" style={{ fontSize: 48, color: '#ef4444', marginBottom: 16 }}></i>
        <p style={{ color: '#dc2626', fontSize: 18, fontWeight: 600 }}>Access Denied</p>
        <p style={{ color: '#6b7280' }}>You must be an administrator to view this page.</p>
      </div>
    );
  }

  // Helper to get role badge colour
  const getRoleColor = (role) => {
    switch (role?.toLowerCase()) {
      case 'admin': return '#7c3aed';
      case 'owner': return '#2563eb';
      case 'farm caretaker': return '#10b981';
      default: return '#6b7280';
    }
  };

  return (
    <div className="user-management" style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div className="card" style={{ padding: 24 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
          <h3 style={{ fontSize: 24, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
            <i className="fas fa-shield-alt" style={{ color: '#7c3aed' }}></i> Role Management
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 14, color: online ? '#10b981' : '#ef4444', fontWeight: 600 }}>
              <i className={`fas fa-${online ? 'wifi' : 'signal-slash'}`} style={{ marginRight: 6 }}></i>
              {online ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>

        {/* User List */}
        <h4 style={{ fontWeight: 'bold', marginBottom: 12, color: '#374151', fontSize: 16 }}>
          <i className="fas fa-users" style={{ marginRight: 8 }}></i> Registered Users ({users.length})
        </h4>

        {/* Desktop table – hidden on small screens */}
        <div className="desktop-table" style={{ overflowX: 'auto', display: 'block' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
              <tr>
                <th style={{ padding: 12, textAlign: 'left', fontSize: 14, fontWeight: 600, color: '#4b5563' }}>Username</th>
                <th style={{ padding: 12, textAlign: 'left', fontSize: 14, fontWeight: 600, color: '#4b5563' }}>Role</th>
                <th style={{ padding: 12, textAlign: 'center', fontSize: 14, fontWeight: 600, color: '#4b5563' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: 8 }}>{u.username}</td>
                  <td>
                    <select
                      value={u.role}
                      onChange={e => updateRole(u.id, e.target.value)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 8,
                        border: '1px solid #d1d5db',
                        background: 'white',
                        fontSize: 13,
                        fontWeight: 500,
                        color: getRoleColor(u.role),
                      }}
                    >
                      <option value="Admin">Admin</option>
                      <option value="Owner">Owner</option>
                      <option value="Farm Caretaker">Farm Caretaker</option>
                    </select>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      onClick={() => deleteUser(u.id)}
                      style={{
                        color: '#ef4444',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '6px 10px',
                        borderRadius: 8,
                        transition: 'background 0.2s',
                      }}
                      onMouseEnter={(e) => e.target.style.background = '#fef2f2'}
                      onMouseLeave={(e) => e.target.style.background = 'transparent'}
                    >
                      <i className="fas fa-trash-alt"></i>
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan="3" style={{ textAlign: 'center', padding: 24, color: '#6b7280' }}>No users found.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile card list – hidden on desktop */}
        <div className="mobile-list" style={{ display: 'none' }}>
          {users.map(u => (
            <div key={u.id} style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 12, marginBottom: 12, background: '#fafafa' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600 }}>{u.username}</span>
                <span
                  style={{
                    background: getRoleColor(u.role),
                    color: 'white',
                    padding: '2px 10px',
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {u.role}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                <select
                  value={u.role}
                  onChange={e => updateRole(u.id, e.target.value)}
                  style={{
                    flex: 1,
                    padding: '4px 10px',
                    borderRadius: 8,
                    border: '1px solid #d1d5db',
                    background: 'white',
                    fontSize: 13,
                  }}
                >
                  <option value="Admin">Admin</option>
                  <option value="Owner">Owner</option>
                  <option value="Farm Caretaker">Farm Caretaker</option>
                </select>
                <button
                  onClick={() => deleteUser(u.id)}
                  style={{
                    color: '#ef4444',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px 10px',
                    borderRadius: 8,
                    background: '#fee2e2',
                  }}
                >
                  <i className="fas fa-trash-alt"></i>
                </button>
              </div>
            </div>
          ))}
          {users.length === 0 && <p style={{ color: '#6b7280', textAlign: 'center', padding: 16 }}>No users found.</p>}
        </div>

        {/* Create New User Section */}
        <div style={{ marginTop: 28, padding: 20, background: '#f9fafb', borderRadius: 16, border: '1px solid #e5e7eb' }}>
          <h4 style={{ fontWeight: 'bold', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="fas fa-user-plus" style={{ color: '#10b981' }}></i> Create New User
          </h4>

          {!online && (
            <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', padding: '10px 16px', borderRadius: 12, color: '#b91c1c', fontSize: 13, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <i className="fas fa-exclamation-triangle"></i>
              <span>Creating users requires an internet connection to sync auth credentials.</span>
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              createUser();
            }}
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}
          >
            <div>
              <label style={{ display: 'block', fontWeight: 500, fontSize: 14, marginBottom: 4 }}>Email</label>
              <input
                type="email"
                placeholder="user@example.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                disabled={!online}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', background: online ? 'white' : '#f3f4f6', opacity: online ? 1 : 0.6 }}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 500, fontSize: 14, marginBottom: 4 }}>Username</label>
              <input
                type="text"
                placeholder="johndoe"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                disabled={!online}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', background: online ? 'white' : '#f3f4f6', opacity: online ? 1 : 0.6 }}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 500, fontSize: 14, marginBottom: 4 }}>Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={!online}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', background: online ? 'white' : '#f3f4f6', opacity: online ? 1 : 0.6 }}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 500, fontSize: 14, marginBottom: 4 }}>Role</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                disabled={!online}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', background: online ? 'white' : '#f3f4f6', opacity: online ? 1 : 0.6 }}
              >
                <option>Farm Caretaker</option>
                <option>Owner</option>
                <option>Admin</option>
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1', marginTop: 4 }}>
              <button
                type="submit"
                className="btn-primary"
                disabled={loading || !online}
                style={{
                  width: '100%',
                  background: loading || !online ? '#9ca3af' : '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  padding: '10px 16px',
                  fontWeight: 600,
                  cursor: loading || !online ? 'not-allowed' : 'pointer',
                  opacity: loading || !online ? 0.7 : 1,
                  transition: 'background 0.2s',
                }}
              >
                {loading ? <><i className="fas fa-spinner fa-spin"></i> Creating...</> : <><i className="fas fa-plus-circle"></i> Create User</>}
              </button>
            </div>
          </form>
        </div>
      </div>

      <style>{`
        .user-management .card {
          background: white;
          border-radius: 16px;
          padding: 24px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
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
        .btn-primary:hover:not(:disabled) {
          background: #059669;
        }

        @media (max-width: 768px) {
          .user-management .card {
            padding: 16px;
          }
          .desktop-table {
            display: none !important;
          }
          .mobile-list {
            display: block !important;
          }
          form {
            grid-template-columns: 1fr !important;
          }
          form div:last-child {
            grid-column: auto !important;
          }
        }

        @media (min-width: 769px) {
          .desktop-table {
            display: block !important;
          }
          .mobile-list {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}