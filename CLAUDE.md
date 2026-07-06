# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Snap is a URL shortener with analytics. It has two independent sub-projects:

- **`/` (root)** — Express 5 + TypeScript backend, SQLite via `better-sqlite3`, JWT auth
- **`frontend/`** — Vite 6 + React 18 + TypeScript SPA

## Commands

### Backend (run from project root)

```bash
npm run dev          # tsx watch — restarts on file changes
npm test             # vitest run (all tests, in-memory DB)
npm run test:watch   # vitest watch mode
npm run build        # tsc → dist/
npm start            # node dist/server.js
```

Run a single test file:
```bash
npx vitest run tests/urls.test.ts
```

### Frontend (run from `frontend/`)

```bash
npm run dev     # Vite dev server on :5173
npm run build   # tsc + vite build → frontend/dist/
```

Both servers must run simultaneously during development: backend on `:3000`, frontend on `:5173`.

## Environment variables

| Variable | Default | Notes |
|---|---|---|
| `PORT` | `3000` | |
| `BASE_URL` | `http://localhost:PORT` | Required in production |
| `JWT_SECRET` | `dev-secret-not-for-production` | Required in production |
| `DB_NAME` | `snap.db` | SQLite file placed in `data/` |
| `CORS_ORIGIN` | `http://localhost:5173` | Frontend origin |

Frontend reads `VITE_API_URL` (defaults to `http://localhost:3000` in `api/client.ts`).

## Architecture

### Backend request flow

```
src/server.ts → src/app.ts (Express) → routers → repositories → SQLite
```

- **`src/app.ts`** — mounts all routers and global middleware (CORS, JSON, logger, error handlers). The wildcard `GET /:code` redirect route is registered last to avoid shadowing API routes.
- **`src/config.ts`** — single `Config` object loaded at startup; throws on missing required env vars in production.
- **`src/db/database.ts`** — creates the SQLite connection, runs `CREATE TABLE IF NOT EXISTS` schema and a migration guard. In `NODE_ENV=test` uses `:memory:`.
- **`src/types/express.d.ts`** — augments `Request` with `req.user: { id, email }` injected by `authenticate()`.

### Auth

`authenticate` middleware in `src/auth/authMiddleware.ts` validates the `Authorization: Bearer <token>` header and injects `req.user`. JWT payload is `{ sub: userId, email }`, expiry 24 h.

### URL shortening

`POST /urls` accepts `{ url, alias? }`. Alias constraints: 3–30 chars matching `/^[a-zA-Z0-9_-]+$/`, not in `RESERVED_SHORT_CODES`. Without alias, `generateShortCode()` (`src/urls/shortCode.ts`) produces a 7-char random alphanumeric string with up to 5 collision-retry attempts.

`GET /:shortCode` is handled by `redirectToOriginalUrl` (not inside `urlsRouter`) to keep it at the Express app level and record a click row on every hit.

### Data model

Three tables: `users`, `urls` (FK → users), `clicks` (FK → urls, `ON DELETE CASCADE`). WAL mode enabled. Indexes on `urls.user_id`, `clicks(url_id, clicked_at)`, `urls(user_id, created_at)`.

`GET /urls/mine` returns a user's URLs with click counts via a `LEFT JOIN` on clicks — it must be registered **before** `GET /:id/stats` in `urlsRouter` to avoid the parameterised route capturing the literal segment `mine`.

### Dashboard

`GET /dashboard` executes two SQLite queries per request (summary + trends). No caching. All time windows are computed with SQLite `date('now', '-N days')`.

### Frontend architecture

```
src/main.tsx → App.tsx (BrowserRouter + AuthProvider) → pages
```

- **`context/AuthContext.tsx`** — sole source of truth for auth state. Reads `token` + `user` from `localStorage` on init. `clearAuth()` is called on 401 responses and on logout.
- **`api/client.ts`** — `apiRequest<T>()` wrapper: adds `Authorization` header from `localStorage`, throws `ApiError` on non-2xx, returns `undefined` for 204 responses (important: `DELETE /urls/:id` returns 204 with no body).
- **`components/PrivateRoute.tsx`** — redirects to `/login` if no token in context.
- Pages call `handleAuthError(err)` which triggers `clearAuth()` + redirect on any 401.

## Testing conventions

Tests start their own Express server on a random port (`app.listen(0)`) and use the in-memory SQLite DB (`NODE_ENV=test` → `:memory:`). Each test file that touches the DB calls `db.exec("DELETE FROM ...")` in `beforeEach` to isolate state. No mocking of the database layer — tests hit real SQL.
