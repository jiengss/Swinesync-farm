import React, { useEffect, useState } from 'react';
import { getNotifications, markAllRead } from '../lib/notifications';

export default function NotificationsPanel({ open, onClose, profile, onCountChange }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open && profile?.role) {
      loadNotifications();
    }
  }, [open, profile?.role]);

  async function loadNotifications() {
    setLoading(true);
    try {
      const data = await getNotifications(profile.role);
      setNotifications(data || []);
      const unreadCount = (data || []).filter(n => !n.read).length;
      onCountChange(unreadCount);
    } catch (err) {
      console.error('Failed to load notifications:', err);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleMarkAllRead() {
    await markAllRead(profile.role);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    onCountChange(0);
  }

  const icons = {
    pig_added: '🐷',
    feed_logged: '🌾',
    low_stock: '⚠️',
    growth_recorded: '📏',
    mortality_recorded: '💀',
    health_recorded: '💉',
    health_treatment: '🩺',
    vaccination_due: '📅',
    vaccination_overdue: '🚨',
    missed_feeding: '🍽️',
  };

  const titles = {
    pig_added: 'New Pig Added',
    feed_logged: 'Feed Logged',
    low_stock: 'Low Stock Alert',
    growth_recorded: 'Growth Recorded',
    mortality_recorded: 'Mortality Reported',
    health_recorded: 'Health Record Added',
    health_treatment: 'Treatment Applied',
    vaccination_due: 'Vaccination Due',
    vaccination_overdue: 'Vaccination Overdue',
    missed_feeding: 'Missed Feeding',
  };

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div 
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.4)',
            backdropFilter: 'blur(4px)',
            zIndex: 1000,
            transition: 'opacity 0.3s'
          }}
        />
      )}
      
      {/* Panel */}
      <div 
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          maxWidth: 420,
          backgroundColor: '#fff',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.15)',
          zIndex: 1001,
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Header */}
        <div style={{ 
          padding: '24px', 
          borderBottom: '1px solid #e5e7eb', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          backgroundColor: '#f8fafc' 
        }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: '#1f2937', display: 'flex', alignItems: 'center', gap: 10 }}>
            <i className="fas fa-bell" style={{ color: '#10b981' }}></i>
            Notifications
          </h2>
          <button 
            onClick={onClose}
            style={{
              background: 'white', 
              border: '1px solid #e5e7eb', 
              borderRadius: '50%',
              width: 36,
              height: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer', 
              color: '#6b7280', 
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#f3f4f6';
              e.currentTarget.style.color = '#1f2937';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'white';
              e.currentTarget.style.color = '#6b7280';
            }}
          >
            <i className="fas fa-times"></i>
          </button>
        </div>

        {/* Actions */}
        <div style={{ padding: '12px 24px', display: 'flex', justifyContent: 'flex-end', borderBottom: '1px solid #e5e7eb', backgroundColor: '#fff' }}>
          <button 
            onClick={handleMarkAllRead}
            disabled={!notifications.some(n => !n.read)}
            style={{
              background: 'none', 
              border: 'none', 
              color: notifications.some(n => !n.read) ? '#059669' : '#9ca3af', 
              fontSize: 14, 
              fontWeight: 600, 
              cursor: notifications.some(n => !n.read) ? 'pointer' : 'default',
              display: 'flex', 
              alignItems: 'center', 
              gap: 6,
              transition: 'color 0.2s'
            }}
          >
            <i className="fas fa-check-double"></i>
            Mark all as read
          </button>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0' }}>
          {loading ? (
            <div style={{ padding: '60px 24px', textAlign: 'center', color: '#6b7280' }}>
              <i className="fas fa-spinner fa-pulse" style={{ fontSize: 32, marginBottom: 16, color: '#10b981' }}></i>
              <div style={{ fontSize: 15, fontWeight: 500 }}>Loading notifications...</div>
            </div>
          ) : notifications.length === 0 ? (
            <div style={{ padding: '80px 24px', textAlign: 'center', color: '#6b7280' }}>
              <div style={{ fontSize: 56, marginBottom: 20 }}>📭</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: '#374151' }}>No notifications yet</div>
              <div style={{ fontSize: 15, marginTop: 6 }}>You're all caught up!</div>
            </div>
          ) : (
            notifications.map(notif => (
              <div 
                key={notif.id}
                style={{
                  padding: '20px 24px',
                  borderBottom: '1px solid #f3f4f6',
                  backgroundColor: notif.read ? '#fff' : '#ecfdf5',
                  transition: 'background-color 0.3s',
                  display: 'flex',
                  gap: 16,
                  position: 'relative'
                }}
              >
                {!notif.read && (
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: '#10b981' }} />
                )}
                
                <div style={{ 
                  fontSize: 24, 
                  flexShrink: 0, 
                  width: 48,
                  height: 48,
                  backgroundColor: notif.read ? '#f3f4f6' : '#d1fae5',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {icons[notif.type] || '🔔'}
                </div>
                
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, color: '#1f2937', fontSize: 15 }}>
                      {titles[notif.type] || 'Notification'}
                    </span>
                    <span style={{ color: '#9ca3af', fontSize: 12, whiteSpace: 'nowrap' }}>
                      {new Date(notif.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  
                  <div style={{ color: '#4b5563', fontSize: 14, lineHeight: 1.5, marginBottom: 10 }}>
                    {notif.message}
                  </div>
                  
                  <div style={{ color: '#9ca3af', fontSize: 12, display: 'flex', justifyContent: 'space-between' }}>
                    <span>{new Date(notif.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
                    {notif.actor_name && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <i className="fas fa-user-circle" style={{ opacity: 0.6 }}></i>
                        {notif.actor_name}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
