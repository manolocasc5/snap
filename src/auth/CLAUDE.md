# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Responsabilidad del módulo

Registro, login y protección de rutas. Cuatro archivos con responsabilidades estrictas:

| Archivo | Qué hace |
|---|---|
| `usersRepository.ts` | SQL puro: `insertUser`, `findUserByEmail`. No sabe nada de bcrypt ni JWT. |
| `authService.ts` | Lógica de negocio: hashea contraseñas, firma tokens, normaliza emails. |
| `authRouter.ts` | Validación de entrada HTTP y mapeo de `AuthError` a códigos HTTP. |
| `authMiddleware.ts` | Verifica el JWT en cada request protegida e inyecta `req.user`. |

## Invariantes que no deben romperse

**Email siempre en minúsculas en la BD.** Tanto `register` como `login` llaman a `email.toLowerCase()` antes de tocar la base de datos. `findUserByEmail` no normaliza — recibe el email ya normalizado. Si añades una vía nueva de acceso a usuarios, normaliza antes de consultar.

**`AuthError` tiene dos códigos exactos.** El router los mapea a HTTP así:
- `EMAIL_TAKEN` → 409
- `INVALID_CREDENTIALS` → 401

El router hace `throw err` para cualquier error que no sea `AuthError`, delegando al `errorHandler` global de `app.ts`. No añadas `try/catch` genéricos en el router que silencien errores inesperados.

**`passwordHash` nunca sale en respuestas HTTP.** `AuthResult` (definido en `authService.ts`) sólo expone `{ id, email, name, createdAt }`. El router devuelve `AuthResult` directamente — no construyas objetos de respuesta a mano a partir de `UserRecord`.

**`sub` en el JWT es un string, `req.user.id` es un número.** El middleware hace `Number(payload.sub)` al inyectar `req.user`. Si generas tokens manualmente en tests, pasa `sub: String(userId)`.

## Bcrypt rounds

`BCRYPT_ROUNDS` es `1` en `NODE_ENV=test` y `10` en cualquier otro entorno. Esto hace que los tests de registro/login sean rápidos. No uses un valor fijo en tests nuevos — deja que `authService` lo gestione.

## Tests relevantes

```
tests/auth.test.ts          # authService (register, login) — usa DB en memoria directamente
tests/authMiddleware.test.ts # authenticate() — crea un mini-app Express propio, sin DB
tests/authRoutes.test.ts    # POST /auth/register y /auth/login — usa app completa
```

`authMiddleware.test.ts` no necesita DB porque prueba el middleware de forma aislada con tokens fabricados con `jwt.sign`. Si añades lógica al middleware que requiera consultar la BD, ese test necesitará actualizarse.

Para añadir protección a una ruta nueva, importa y pasa `authenticate` como middleware:

```typescript
import { authenticate } from "../auth/authMiddleware.js";
router.post("/ruta-protegida", authenticate, handler);
```

`req.user` estará disponible en `handler` con tipo `{ id: number; email: string }` (declarado en `src/types/express.d.ts`).
