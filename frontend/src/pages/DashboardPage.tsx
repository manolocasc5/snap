import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '../api/client'
import { getDashboard } from '../api/dashboard'
import { createUrl, deleteUrl, getMyUrls } from '../api/urls'
import { useAuth } from '../context/AuthContext'
import type { DashboardData, UrlWithClicks } from '../types'

export function DashboardPage() {
  const { user, clearAuth } = useAuth()
  const navigate = useNavigate()

  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [myUrls, setMyUrls] = useState<UrlWithClicks[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [dataError, setDataError] = useState<string | null>(null)

  const [newUrl, setNewUrl] = useState('')
  const [alias, setAlias] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<number | null>(null)

  function handleAuthError(err: unknown) {
    if (err instanceof ApiError && err.status === 401) {
      clearAuth()
      navigate('/login')
    }
  }

  useEffect(() => {
    async function loadData() {
      setLoadingData(true)
      setDataError(null)
      try {
        const [dash, urls] = await Promise.all([getDashboard(), getMyUrls()])
        setDashboard(dash)
        setMyUrls(urls)
      } catch (err) {
        handleAuthError(err)
        setDataError(err instanceof ApiError ? err.message : 'Error al cargar los datos.')
      } finally {
        setLoadingData(false)
      }
    }
    void loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    setCreating(true)
    setCreateError(null)
    try {
      const created = await createUrl(newUrl.trim(), alias.trim() || undefined)
      setMyUrls(prev => [{ ...created, clicks: 0 }, ...prev])
      setDashboard(prev =>
        prev
          ? { ...prev, summary: { ...prev.summary, totalUrls: prev.summary.totalUrls + 1 } }
          : prev,
      )
      setNewUrl('')
      setAlias('')
    } catch (err) {
      handleAuthError(err)
      setCreateError(err instanceof ApiError ? err.message : 'Error al crear la URL.')
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(id: number) {
    setDeletingId(id)
    setDeleteError(null)
    try {
      await deleteUrl(id)
      setMyUrls(prev => prev.filter(u => u.id !== id))
      setDashboard(prev =>
        prev
          ? { ...prev, summary: { ...prev.summary, totalUrls: prev.summary.totalUrls - 1 } }
          : prev,
      )
    } catch (err) {
      handleAuthError(err)
      setDeleteError(err instanceof ApiError ? err.message : 'Error al eliminar la URL.')
    } finally {
      setDeletingId(null)
    }
  }

  async function handleCopy(shortUrl: string, id: number) {
    await navigator.clipboard.writeText(shortUrl)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  function handleLogout() {
    clearAuth()
    navigate('/login')
  }

  const { summary } = dashboard ?? {}

  return (
    <div className="dash-layout">
      <nav className="navbar">
        <span className="navbar-logo">⚡ Snap</span>
        <div className="navbar-right">
          <span className="navbar-user">Hola, {user?.name}</span>
          <button className="btn btn-ghost" onClick={handleLogout}>
            Cerrar sesión
          </button>
        </div>
      </nav>

      <main className="dash-main">
        {/* Stats */}
        {loadingData ? (
          <p className="loading-text">Cargando…</p>
        ) : dataError ? (
          <div className="auth-error">{dataError}</div>
        ) : (
          <div className="stats-grid">
            <div className="stat-card">
              <span className="stat-value">{summary?.totalUrls ?? 0}</span>
              <span className="stat-label">URLs creadas</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{summary?.totalClicks ?? 0}</span>
              <span className="stat-label">Clicks totales</span>
            </div>
            <div className="stat-card">
              {summary?.topUrl ? (
                <>
                  <span className="stat-value">{summary.topUrl.clicks}</span>
                  <span className="stat-label">
                    Clicks en{' '}
                    <code className="code-inline">/{summary.topUrl.shortCode}</code>
                  </span>
                </>
              ) : (
                <>
                  <span className="stat-value">—</span>
                  <span className="stat-label">Sin URL destacada</span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Create form */}
        <section className="card">
          <h2 className="card-title">Nueva URL corta</h2>
          {createError && (
            <div className="auth-error" role="alert">
              {createError}
            </div>
          )}
          <form onSubmit={handleCreate} className="create-form">
            <div className="create-url-field">
              <label htmlFor="new-url">URL original</label>
              <input
                id="new-url"
                type="url"
                value={newUrl}
                onChange={e => setNewUrl(e.target.value)}
                placeholder="https://ejemplo.com/articulo-muy-largo"
                required
                disabled={creating}
              />
            </div>
            <div className="create-alias-field">
              <label htmlFor="alias">Alias (opcional)</label>
              <input
                id="alias"
                type="text"
                value={alias}
                onChange={e => setAlias(e.target.value)}
                placeholder="mi-alias"
                pattern="[a-zA-Z0-9_\-]{3,30}"
                disabled={creating}
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={creating}>
              {creating ? 'Creando…' : 'Acortar'}
            </button>
          </form>
        </section>

        {/* URL list */}
        <section className="card">
          <h2 className="card-title">Mis URLs</h2>
          {deleteError && (
            <div className="auth-error" role="alert">{deleteError}</div>
          )}
          {myUrls.length === 0 && !loadingData ? (
            <p className="empty-state">Aún no has creado ninguna URL.</p>
          ) : (
            <div className="table-wrapper">
              <table className="urls-table">
                <thead>
                  <tr>
                    <th>Enlace corto</th>
                    <th>URL original</th>
                    <th>Clicks</th>
                    <th>Creada</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {myUrls.map(url => (
                    <tr key={url.id}>
                      <td>
                        <div className="short-url-cell">
                          <a
                            href={url.shortUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="short-link"
                          >
                            /{url.shortCode}
                          </a>
                          <button
                            className="btn-copy"
                            onClick={() => void handleCopy(url.shortUrl, url.id)}
                            title="Copiar enlace"
                          >
                            {copiedId === url.id ? '✓' : '⎘'}
                          </button>
                        </div>
                      </td>
                      <td>
                        <span className="original-url" title={url.originalUrl}>
                          {url.originalUrl}
                        </span>
                      </td>
                      <td>
                        <span className="clicks-badge">{url.clicks}</span>
                      </td>
                      <td className="date-cell">
                        {new Date(url.createdAt).toLocaleDateString('es-ES', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td>
                        <button
                          className="btn btn-danger-sm"
                          onClick={() => void handleDelete(url.id)}
                          disabled={deletingId === url.id}
                          title="Eliminar URL"
                        >
                          {deletingId === url.id ? '…' : '✕'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
