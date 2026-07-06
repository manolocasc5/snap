import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '../api/client'
import { login, register } from '../api/auth'
import { useAuth } from '../context/AuthContext'

type Tab = 'login' | 'register'

export function LoginPage() {
  const navigate = useNavigate()
  const { saveAuth } = useAuth()

  const [tab, setTab] = useState<Tab>('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  const [regName, setRegName] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')

  function switchTab(newTab: Tab) {
    setTab(newTab)
    setError(null)
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const { token, user } = await login(loginEmail, loginPassword)
      saveAuth(token, user)
      navigate('/dashboard')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error inesperado. Inténtalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  async function handleRegister(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const { token, user } = await register(regName, regEmail, regPassword)
      saveAuth(token, user)
      navigate('/dashboard')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error inesperado. Inténtalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <h1 className="auth-logo">⚡ Snap</h1>
          <p className="auth-subtitle">Acortador de URLs con analíticas</p>
        </div>

        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab${tab === 'login' ? ' active' : ''}`}
            onClick={() => switchTab('login')}
          >
            Iniciar sesión
          </button>
          <button
            type="button"
            className={`auth-tab${tab === 'register' ? ' active' : ''}`}
            onClick={() => switchTab('register')}
          >
            Registrarse
          </button>
        </div>

        {error && <div className="auth-error" role="alert">{error}</div>}

        {tab === 'login' ? (
          <form onSubmit={handleLogin} className="auth-form">
            <div className="field">
              <label htmlFor="login-email">Email</label>
              <input
                id="login-email"
                type="email"
                value={loginEmail}
                onChange={e => setLoginEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="tu@email.com"
                disabled={loading}
              />
            </div>
            <div className="field">
              <label htmlFor="login-password">Contraseña</label>
              <input
                id="login-password"
                type="password"
                value={loginPassword}
                onChange={e => setLoginPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                disabled={loading}
              />
            </div>
            <button type="submit" className="auth-submit" disabled={loading}>
              {loading ? 'Entrando…' : 'Iniciar sesión'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="auth-form">
            <div className="field">
              <label htmlFor="reg-name">Nombre</label>
              <input
                id="reg-name"
                type="text"
                value={regName}
                onChange={e => setRegName(e.target.value)}
                required
                autoComplete="name"
                placeholder="Tu nombre"
                disabled={loading}
              />
            </div>
            <div className="field">
              <label htmlFor="reg-email">Email</label>
              <input
                id="reg-email"
                type="email"
                value={regEmail}
                onChange={e => setRegEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="tu@email.com"
                disabled={loading}
              />
            </div>
            <div className="field">
              <label htmlFor="reg-password">Contraseña</label>
              <input
                id="reg-password"
                type="password"
                value={regPassword}
                onChange={e => setRegPassword(e.target.value)}
                required
                autoComplete="new-password"
                placeholder="Mínimo 8 caracteres"
                disabled={loading}
              />
            </div>
            <button type="submit" className="auth-submit" disabled={loading}>
              {loading ? 'Creando cuenta…' : 'Crear cuenta'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
