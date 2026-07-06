# Snap API

Base URL: `http://localhost:3000` (desarrollo) — configurable con `BASE_URL`.

Todos los endpoints devuelven JSON. Los errores siguen el formato `{ "error": "descripción" }`.

---

## Autenticación

Los endpoints protegidos requieren un token JWT en la cabecera:

```
Authorization: Bearer <token>
```

El token se obtiene en `POST /auth/login` o `POST /auth/register`.

---

## Auth

### POST /auth/register

Registra un nuevo usuario.

**Body**
```json
{ "email": "ana@example.com", "password": "mipassword", "name": "Ana" }
```

| Campo | Tipo | Restricciones |
|-------|------|---------------|
| `email` | string | Formato email válido, único en el sistema |
| `password` | string | Mínimo 8 caracteres |
| `name` | string | No vacío |

**Respuesta 201**
```json
{
  "token": "eyJhbGci...",
  "user": { "id": 1, "email": "ana@example.com", "name": "Ana", "createdAt": "2026-07-06T21:00:00" }
}
```

**Errores**
| Código | Motivo |
|--------|--------|
| 400 | Campo faltante o inválido |
| 409 | Email ya registrado |

---

### POST /auth/login

Inicia sesión y devuelve un token JWT.

**Body**
```json
{ "email": "ana@example.com", "password": "mipassword" }
```

**Respuesta 200**
```json
{
  "token": "eyJhbGci...",
  "user": { "id": 1, "email": "ana@example.com", "name": "Ana", "createdAt": "2026-07-06T21:00:00" }
}
```

**Errores**
| Código | Motivo |
|--------|--------|
| 400 | Campo faltante |
| 401 | Credenciales incorrectas |

---

## URLs

### POST /urls 🔒

Crea una URL corta. Requiere autenticación.

**Body**
```json
{ "url": "https://ejemplo.com/articulo-muy-largo" }
```

**Respuesta 201**
```json
{
  "id": 42,
  "shortCode": "aB3xY7z",
  "originalUrl": "https://ejemplo.com/articulo-muy-largo",
  "shortUrl": "http://localhost:3000/aB3xY7z",
  "userId": 1,
  "createdAt": "2026-07-06T21:00:00"
}
```

**Errores**
| Código | Motivo |
|--------|--------|
| 400 | `url` ausente, vacía o no es una URL absoluta válida |
| 401 | Sin token o token inválido |

---

### GET /urls

Lista todas las URLs del sistema (público).

**Respuesta 200** — array de objetos con la misma estructura que `POST /urls`.

---

### DELETE /urls/:id 🔒

Elimina una URL por ID. Solo el propietario puede eliminarla.

**Respuesta 204** — sin cuerpo.

**Errores**
| Código | Motivo |
|--------|--------|
| 400 | ID no es un entero positivo |
| 401 | Sin token o token inválido |
| 403 | La URL pertenece a otro usuario |
| 404 | URL no encontrada |

---

### GET /urls/stats

Ranking global de URLs por número de clicks (público).

**Respuesta 200**
```json
[
  { "urlId": 42, "shortCode": "aB3xY7z", "originalUrl": "https://ejemplo.com/...", "totalClicks": 310 },
  { "urlId": 7,  "shortCode": "cD9mN2p", "originalUrl": "https://otro.com/...",   "totalClicks": 124 }
]
```

---

### GET /urls/:id/stats

Estadísticas de clicks de una URL concreta (público).

**Respuesta 200**
```json
{
  "url": {
    "id": 42, "shortCode": "aB3xY7z", "originalUrl": "https://ejemplo.com/...",
    "shortUrl": "http://localhost:3000/aB3xY7z", "userId": 1, "createdAt": "2026-07-06T21:00:00"
  },
  "stats": {
    "totalClicks": 310,
    "clicksByDay": [
      { "date": "2026-07-01", "clicks": 45 },
      { "date": "2026-07-06", "clicks": 18 }
    ],
    "topReferers": [
      { "referer": "https://twitter.com", "clicks": 120 },
      { "referer": null, "clicks": 90 }
    ]
  }
}
```

`clicksByDay` incluye los últimos 30 días con actividad. `topReferers` devuelve hasta 10 entradas; `referer: null` representa visitas directas.

**Errores**
| Código | Motivo |
|--------|--------|
| 400 | ID no es un entero positivo |
| 404 | URL no encontrada |

---

## Redirección

### GET /:shortCode

Redirige al destino original. Registra el click automáticamente.

**Respuesta 302** — cabecera `Location` apunta a la URL original.

**Respuesta 404** — si el código no existe.

---

## Dashboard

### GET /dashboard 🔒

Vista general del rendimiento de las URLs del usuario autenticado. Devuelve totales acumulados y tendencias de los últimos 30 días.

**Respuesta 200**
```json
{
  "summary": {
    "totalUrls": 12,
    "totalClicks": 847,
    "topUrl": {
      "shortCode": "aB3xY7z",
      "originalUrl": "https://ejemplo.com/articulo-muy-largo",
      "shortUrl": "http://localhost:3000/aB3xY7z",
      "clicks": 310
    }
  },
  "trends": {
    "clicksThisWeek": 124,
    "clicksLastWeek": 98,
    "changePercent": 26.5,
    "clicksByDay": [
      { "date": "2026-07-01", "clicks": 18 },
      { "date": "2026-07-06", "clicks": 45 }
    ],
    "urlsCreatedByWeek": [
      { "week": "2026-W24", "urlsCreated": 2 },
      { "week": "2026-W27", "urlsCreated": 5 }
    ]
  }
}
```

**Campos**

| Campo | Descripción |
|-------|-------------|
| `summary.totalUrls` | Total de URLs creadas por el usuario |
| `summary.totalClicks` | Clicks acumulados en todas sus URLs |
| `summary.topUrl` | URL con más clicks; `null` si no tiene URLs |
| `trends.clicksThisWeek` | Clicks en los últimos 7 días |
| `trends.clicksLastWeek` | Clicks en los 7 días anteriores |
| `trends.changePercent` | Variación porcentual semana a semana; `null` si no hay datos previos |
| `trends.clicksByDay` | Clicks por día (últimos 30 días con actividad, orden ascendente) |
| `trends.urlsCreatedByWeek` | URLs creadas por semana (últimas 4 semanas con actividad) |

**Errores**
| Código | Motivo |
|--------|--------|
| 401 | Sin token o token inválido |

---

## Salud

### GET /health

Comprueba que el servidor está activo (público).

**Respuesta 200**
```json
{ "status": "ok" }
```
