import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Swal from 'sweetalert2'

export default function Login({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [role, setRole] = useState('Farm Caretaker')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [online, setOnline] = useState(navigator.onLine)

  useEffect(() => {
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        onLogin()
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username: username,
              role: role
            }
          }
        })
        if (error) throw error

        if (data?.user?.identities?.length === 0) {
          Swal.fire('Info', 'This email is already registered. Please log in.', 'info')
          setIsLogin(true)
        } else {
          Swal.fire('Success', 'Registration successful! Please check your email to confirm (if required), then log in.', 'success')
          setIsLogin(true)
        }
        setEmail('')
        setPassword('')
        setUsername('')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #064e3b, #065f46, #0f766e)', opacity: 0.95 }}></div>
      <div style={{ position: 'relative', zIndex: 10, background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(4px)', borderRadius: 32, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', maxWidth: 420, width: '100%', padding: 32, border: '1px solid rgba(255,255,255,0.4)' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ display: 'inline-flex', padding: 12, background: '#d1fae5', borderRadius: 999, marginBottom: 12 }}>
            <i className="fas fa-piggy-bank" style={{ fontSize: 48, color: '#047857' }}></i>
          </div>
          <h1 style={{ fontSize: 36, fontWeight: 900, color: '#1f2937' }}>SwineSync</h1>
          <p style={{ color: '#047857', fontWeight: 500 }}>AI-Powered Herd Management</p>
        </div>

        {!online && (
          <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', padding: '10px 16px', borderRadius: 16, color: '#b91c1c', fontSize: 13, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8, lineHeight: 1.4 }}>
            <i className="fas fa-exclamation-triangle" style={{ fontSize: 16, flexShrink: 0 }}></i>
            <span><strong>Offline Mode active.</strong> Logging in with new credentials or signing up requires internet. Your last active session will be loaded if cached.</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Username</label>
                <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required style={{ width: '100%', border: '2px solid #e5e7eb', borderRadius: 16, padding: '12px 16px', fontSize: 16 }} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Role</label>
                <select value={role} onChange={(e) => setRole(e.target.value)} style={{ width: '100%', border: '2px solid #e5e7eb', borderRadius: 16, padding: '12px 16px', fontSize: 16, background: 'white' }}>
                  <option value="Farm Caretaker">Farm Caretaker</option>
                  <option value="Owner">Farm Owner</option>
                  <option value="Admin">System Admin</option>
                </select>
                <p style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>Select your role – Owners can view caretaker progress reports.</p>
              </div>
            </>
          )}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ width: '100%', border: '2px solid #e5e7eb', borderRadius: 16, padding: '12px 16px', fontSize: 16 }} />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ width: '100%', border: '2px solid #e5e7eb', borderRadius: 16, padding: '12px 16px', fontSize: 16 }} />
          </div>
          {error && <div style={{ marginBottom: 16, color: '#dc2626', fontSize: 14 }}>{error}</div>}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              background: loading ? '#9ca3af' : 'linear-gradient(135deg, #059669, #0d9488)',
              color: 'white',
              fontWeight: 'bold',
              padding: 12,
              borderRadius: 16,
              border: 'none',
              fontSize: 16,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              transition: 'all 0.2s'
            }}
          >
            {loading ? (
              <><i className="fas fa-spinner fa-spin" style={{ marginRight: 8 }}></i> Please wait...</>
            ) : (
              <><i className="fas fa-sign-in-alt" style={{ marginRight: 8 }}></i> {isLogin ? 'Enter SwineSync' : 'Create Account'}</>
            )}
          </button>
        </form>
        <button
          onClick={() => setIsLogin(!isLogin)}
          style={{ marginTop: 16, width: '100%', color: '#047857', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}
        >
          {isLogin ? ' Create New Account' : '← Back to Login'}
        </button>
      </div>
    </div>
  )
}