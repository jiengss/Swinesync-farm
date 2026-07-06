import { useState, useEffect, useCallback } from 'react'
import { supabase } from './lib/supabase'
import { dataAPI } from './lib/data'
import { syncAll, isOnline } from './lib/sync'
import { getUnreadCount, subscribeToNotifications } from './lib/notifications'
import './App.css'
import Login from './components/Login'
import Sidebar from './components/Sidebar'
import Dashboard from './components/Dashboard'
import Breeding from './components/Breeding'
import Feeding from './components/Feeding'
import Health from './components/Health'
import Inventory from './components/Inventory'
import GrowthMortality from './components/GrowthMortality'
import Financial from './components/Financial'
import Reports from './components/Reports'
import UserManagement from './components/UserManagement'
import NotificationsPanel from './components/NotificationsPanel'

const modules = {
  dashboard: Dashboard,
  breeding: Breeding,
  feeding: Feeding,
  health: Health,
  inventory: Inventory,
  growth: GrowthMortality,
  financial: Financial,
  reports: Reports,
  users: UserManagement
}

const PROFILE_CACHE_KEY = 'swinesync_cached_profile'
const SESSION_CACHE_KEY = 'swinesync_cached_session'

function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeModule, setActiveModule] = useState('dashboard')
  const [currentTime, setCurrentTime] = useState(new Date())
  const [notificationCount, setNotificationCount] = useState(0)
  const [notifPanelOpen, setNotifPanelOpen] = useState(false)

  // --- Auth & session handling (with offline fallback) ---
  useEffect(() => {
    async function initSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        setSession(session)
        if (session) {
          try {
            localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify({
              user: { id: session.user.id, email: session.user.email }
            }))
          } catch (e) { /* ignore storage errors */ }
          await fetchProfile(session.user.id)
        } else {
          if (!isOnline()) {
            const cachedSession = loadCachedSession()
            const cachedProfile = loadCachedProfile()
            if (cachedSession && cachedProfile) {
              setSession(cachedSession)
              setProfile(cachedProfile)
            }
          }
          setLoading(false)
        }
      } catch (err) {
        console.error('Session init error:', err)
        const cachedSession = loadCachedSession()
        const cachedProfile = loadCachedProfile()
        if (cachedSession && cachedProfile) {
          setSession(cachedSession)
          setProfile(cachedProfile)
        }
        setLoading(false)
      }
    }
    initSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) {
        try {
          localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify({
            user: { id: session.user.id, email: session.user.email }
          }))
        } catch (e) { /* ignore */ }
        fetchProfile(session.user.id)
      } else {
        setProfile(null)
        try {
          localStorage.removeItem(PROFILE_CACHE_KEY)
          localStorage.removeItem(SESSION_CACHE_KEY)
        } catch (e) { /* ignore */ }
      }
      setLoading(false)
    })

    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => {
      subscription.unsubscribe()
      clearInterval(timer)
    }
  }, [])

  // --- Auto‑sync when coming back online ---
  useEffect(() => {
    const handleOnline = () => {
      if (isOnline()) {
        syncAll().then(() => {
          console.log('🔄 Auto‑sync completed after going online.')
        }).catch(err => {
          console.error('Auto‑sync failed:', err)
        })
      }
    }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [])

  // --- Notification count polling + real-time subscription ---
  const refreshNotifCount = useCallback(async (role) => {
    if (!role) return
    const isOwnerOrAdmin = role === 'Owner' || role === 'Admin'
    if (!isOwnerOrAdmin) return
    try {
      const count = await getUnreadCount(role)
      setNotificationCount(count)
    } catch (e) { /* ignore */ }
  }, [])

  useEffect(() => {
    if (!profile?.role) return
    const isOwnerOrAdmin = profile.role === 'Owner' || profile.role === 'Admin'
    if (!isOwnerOrAdmin) return

    refreshNotifCount(profile.role)

    // Poll every 30 seconds
    const pollInterval = setInterval(() => refreshNotifCount(profile.role), 30000)

    // Real-time subscription
    const unsubscribe = subscribeToNotifications(profile.role, (newNotif) => {
      setNotificationCount(prev => prev + 1)
      // Show a brief toast
      showNotifToast(newNotif)
    })

    return () => {
      clearInterval(pollInterval)
      unsubscribe()
    }
  }, [profile?.role, refreshNotifCount])

  function showNotifToast(notif) {
    const toast = document.createElement('div')
    const icons = { pig_added: '🐷', feed_logged: '🌾', low_stock: '⚠️' }
    const icon = icons[notif.type] || '🔔'
    toast.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;">
        <span style="font-size:22px">${icon}</span>
        <div>
          <div style="font-weight:700;font-size:14px;margin-bottom:2px">${notif.type === 'pig_added' ? 'New Pig Added' : notif.type === 'feed_logged' ? 'Feed Logged' : 'Low Stock Alert'}</div>
          <div style="font-size:13px;color:#374151">${notif.message}</div>
        </div>
      </div>
    `
    toast.style.cssText = `
      position:fixed;bottom:24px;right:24px;z-index:9999;
      background:white;border-radius:16px;padding:16px 20px;
      box-shadow:0 8px 32px rgba(0,0,0,0.18);
      border-left:4px solid #10b981;
      max-width:340px;min-width:260px;
      animation:slideUpToast 0.35s cubic-bezier(0.16,1,0.3,1);
      font-family:inherit;
    `
    document.body.appendChild(toast)
    setTimeout(() => {
      toast.style.animation = 'fadeOutToast 0.3s ease forwards'
      setTimeout(() => toast.remove(), 300)
    }, 5000)
  }

  function loadCachedProfile() {
    try {
      const cached = localStorage.getItem(PROFILE_CACHE_KEY)
      return cached ? JSON.parse(cached) : null
    } catch (e) {
      return null
    }
  }

  function loadCachedSession() {
    try {
      const cached = localStorage.getItem(SESSION_CACHE_KEY)
      return cached ? JSON.parse(cached) : null
    } catch (e) {
      return null
    }
  }

  async function fetchProfile(userId) {
    try {
      const data = await dataAPI.profiles.getById(userId)
      setProfile(data)
      if (data) {
        try {
          localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(data))
        } catch (e) { /* ignore */ }
      }
    } catch (error) {
      console.error('Error fetching profile:', error)
      const cachedProfile = loadCachedProfile()
      if (cachedProfile) {
        setProfile(cachedProfile)
      } else {
        setProfile(null)
      }
    }
    setLoading(false)
  }

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <i className="fas fa-spinner fa-pulse" style={{ fontSize: 40, color: '#059669' }}></i>
    </div>
  }

  if (!session) {
    return <Login onLogin={() => window.location.reload()} />
  }

  const rolePermissions = {
    Admin: ['dashboard', 'breeding', 'feeding', 'health', 'inventory', 'growth', 'financial', 'reports', 'users'],
    Owner: ['dashboard', 'breeding', 'feeding', 'health', 'inventory', 'growth', 'financial', 'reports'],
    'Farm Caretaker': ['dashboard', 'breeding', 'feeding', 'health', 'inventory', 'growth']
  }
  const allowedModules = rolePermissions[profile?.role] || rolePermissions['Farm Caretaker']
  const ActiveComponent = modules[activeModule]

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar
        activeModule={activeModule}
        setActiveModule={setActiveModule}
        allowedModules={allowedModules}
        profile={profile}
        notificationCount={notificationCount}
        onOpenNotifications={() => setNotifPanelOpen(true)}
      />
      <main style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ fontSize: 28, fontWeight: 800, color: '#1f2937', display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="fas fa-chart-line" style={{ color: '#10b981' }}></i>
            {activeModule.charAt(0).toUpperCase() + activeModule.slice(1)}
          </h2>
          <div style={{ background: 'white', borderRadius: 999, padding: '8px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', fontFamily: 'monospace', fontSize: 14 }}>
            {currentTime.toLocaleTimeString()}
          </div>
        </div>
        <ActiveComponent onNavigateToModule={setActiveModule} profile={profile} />
      </main>

      {/* Notifications Panel (Owner/Admin only) */}
      {(profile?.role === 'Owner' || profile?.role === 'Admin') && (
        <NotificationsPanel
          open={notifPanelOpen}
          onClose={() => { setNotifPanelOpen(false); refreshNotifCount(profile.role); }}
          profile={profile}
          onCountChange={(count) => setNotificationCount(count)}
        />
      )}

      <style>{`
        @keyframes slideUpToast {
          from { transform: translateY(40px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes fadeOutToast {
          from { opacity: 1; transform: translateY(0); }
          to { opacity: 0; transform: translateY(20px); }
        }
      `}</style>
    </div>
  )
}

export default App