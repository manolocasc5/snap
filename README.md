# Snap

A URL shortener with per-link click analytics. Paste a long URL, get a short one. Track how many times it's been clicked.

**Stack:** Express 5 + TypeScript · SQLite via `better-sqlite3` · JWT auth · React 18 + Vite 6 SPA

---

## Prerequisites

- Node.js ≥ 20
- npm ≥ 10

---

## Development setup

```bash
# 1. Install backend dependencies
npm install

# 2. Install frontend dependencies
cd frontend && npm install && cd ..

# 3. Start backend (port 3000)
npm run dev

# 4. In a separate terminal, start the frontend (port 5173)
cd frontend && npm run dev
```

Open [http://localhost:5173](http://localhost:5173) to use the app.

The backend API is available at [http://localhost:3000](http://localhost:3000).

---

## Environment variables

### Backend (root `.env`)

| Variable | Default | Notes |
|---|---|---|
| `PORT` | `3000` | |
| `BASE_URL` | `http://localhost:3000` | Required in production — used to build short URLs |
| `JWT_SECRET` | `dev-secret-not-for-production` | Required in production |
| `DB_NAME` | `snap.db` | SQLite file placed in `data/` |
| `CORS_ORIGIN` | `http://localhost:5173` | Must match the frontend origin |

### Frontend (`frontend/.env`)

| Variable | Default | Notes |
|---|---|---|
| `VITE_API_URL` | `http://localhost:3000` | Backend URL |

---

## Running tests

All tests use an in-memory SQLite database and start their own Express server on a random port.

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Single file
npx vitest run tests/urls.test.ts
```

86 tests across 7 test files covering auth, URL creation, aliasing, redirect, click tracking, and the dashboard.

---

## API reference

### Auth

| Method | Path | Body | Description |
|---|---|---|---|
| `POST` | `/auth/register` | `{ email, password, name }` | Create account. Returns `{ token, user }`. |
| `POST` | `/auth/login` | `{ email, password }` | Sign in. Returns `{ token, user }`. |

Emails are normalised to lowercase. Passwords must be ≥ 8 characters.

### URLs

All URL endpoints require `Authorization: Bearer <token>`.

| Method | Path | Body | Description |
|---|---|---|---|
| `POST` | `/urls` | `{ url, alias? }` | Shorten a URL. Optional `alias` (3–30 chars, `[a-zA-Z0-9_-]`). Returns the created URL record including `shortUrl`. |
| `GET` | `/urls/mine` | — | List the authenticated user's URLs with click counts. |
| `GET` | `/urls/:id/stats` | — | Click history for a specific URL. |
| `DELETE` | `/urls/:id` | — | Delete a URL and all its click records. Returns 204. |

**Alias constraints:** 3–30 characters, alphanumeric plus `_` and `-`. Aliases that conflict with reserved paths (`urls`, `auth`, `dashboard`, etc.) or are already taken return `409 Conflict`.

### Redirect

| Method | Path | Description |
|---|---|---|
| `GET` | `/:shortCode` | Redirect to the original URL and record a click. Returns 302. Returns 404 if the code doesn't exist. |

### Dashboard

| Method | Path | Description |
|---|---|---|
| `GET` | `/dashboard` | Summary stats + daily click trends for the authenticated user. |

---

## Project structure

```
├── src/
│   ├── app.ts              # Express app: mounts routers and middleware
│   ├── server.ts           # Entry point: listens on PORT
│   ├── config.ts           # Typed config loaded from env vars
│   ├── auth/
│   │   ├── authMiddleware.ts   # JWT verification, injects req.user
│   │   ├── authRouter.ts       # POST /auth/register, /auth/login
│   │   ├── authService.ts      # register(), login() — hashing and token signing
│   │   └── usersRepository.ts  # insertUser(), findUserByEmail()
│   ├── urls/
│   │   ├── urlsRouter.ts       # POST /urls, GET /urls/mine, etc.
│   │   ├── urlsRepository.ts   # SQL for urls and clicks tables
│   │   └── shortCode.ts        # Random 7-char code generator
│   ├── dashboard/
│   │   └── dashboardRouter.ts  # GET /dashboard
│   ├── db/
│   │   └── database.ts         # SQLite connection, schema, WAL mode
│   └── types/
│       └── express.d.ts        # Augments Request with req.user
├── tests/                  # Vitest integration tests
├── docs/
│   └── API.md              # Full API documentation
├── data/                   # SQLite database files (gitignored)
└── frontend/
    ├── src/
    │   ├── App.tsx             # Router + AuthProvider
    │   ├── api/                # apiRequest wrapper, per-domain modules
    │   ├── context/
    │   │   └── AuthContext.tsx # Auth state + localStorage persistence
    │   ├── components/
    │   │   └── PrivateRoute.tsx # Redirects to /login if no token
    │   └── pages/
    │       ├── LoginPage.tsx   # Login and register tabs
    │       └── DashboardPage.tsx # URL list, creation form, stats
    └── index.html
```

---

## Data model

```sql
users  (id, email, password_hash, name, created_at)
urls   (id, short_code, original_url, user_id → users, created_at)
clicks (id, url_id → urls CASCADE DELETE, clicked_at)
```

WAL mode is enabled. Indexes on `urls.user_id`, `clicks(url_id, clicked_at)`, and `urls(user_id, created_at)`.

---

## Building for production

```bash
# Backend
npm run build    # tsc → dist/
npm start        # node dist/server.js

# Frontend
cd frontend && npm run build   # tsc + vite build → frontend/dist/
```

Set `BASE_URL`, `JWT_SECRET`, and `CORS_ORIGIN` before starting the production server.
