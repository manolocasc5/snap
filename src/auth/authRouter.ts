import { Router, type Request, type Response } from "express";
import { db } from "../db/database.js";
import { AuthError, login, register } from "./authService.js";

const MIN_PASSWORD_LENGTH = 8;

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export const authRouter = Router();

authRouter.post("/register", async (req: Request, res: Response) => {
  const body = req.body as { email?: unknown; password?: unknown; name?: unknown } | undefined;

  if (typeof body?.email !== "string" || body.email.trim() === "") {
    res.status(400).json({ error: 'El campo "email" es obligatorio y debe ser un string.' });
    return;
  }
  if (!isValidEmail(body.email.trim())) {
    res.status(400).json({ error: 'El campo "email" debe ser un email válido.' });
    return;
  }
  if (typeof body?.password !== "string" || body.password.length < MIN_PASSWORD_LENGTH) {
    res.status(400).json({
      error: `El campo "password" debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`,
    });
    return;
  }
  if (typeof body?.name !== "string" || body.name.trim() === "") {
    res.status(400).json({ error: 'El campo "name" es obligatorio y debe ser un string.' });
    return;
  }

  try {
    const result = await register(db, body.email.trim(), body.password, body.name.trim());
    res.status(201).json(result);
  } catch (err) {
    if (err instanceof AuthError && err.code === "EMAIL_TAKEN") {
      res.status(409).json({ error: err.message });
      return;
    }
    throw err;
  }
});

authRouter.post("/login", async (req: Request, res: Response) => {
  const body = req.body as { email?: unknown; password?: unknown } | undefined;

  if (typeof body?.email !== "string" || body.email.trim() === "") {
    res.status(400).json({ error: 'El campo "email" es obligatorio y debe ser un string.' });
    return;
  }
  if (typeof body?.password !== "string" || body.password === "") {
    res.status(400).json({ error: 'El campo "password" es obligatorio y debe ser un string.' });
    return;
  }

  try {
    const result = await login(db, body.email.trim(), body.password);
    res.status(200).json(result);
  } catch (err) {
    if (err instanceof AuthError && err.code === "INVALID_CREDENTIALS") {
      res.status(401).json({ error: err.message });
      return;
    }
    throw err;
  }
});