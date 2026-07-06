import { Router, type NextFunction, type Request, type Response } from "express";
import { authenticate } from "../auth/authMiddleware.js";
import { getTopUrls, getUrlClickStats, insertClick } from "../clicks/clicksRepository.js";
import { config } from "../config.js";
import { db } from "../db/database.js";
import { generateShortCode } from "./shortCode.js";
import {
  deleteUrlById,
  findUrlById,
  findUrlByShortCode,
  insertUrl,
  listUrls,
  listUrlsByUser,
  shortCodeExists,
  type UrlRecord,
} from "./urlsRepository.js";

const RESERVED_SHORT_CODES = new Set(["health", "urls", "auth", "dashboard"]);
const ALIAS_PATTERN = /^[a-zA-Z0-9_-]{3,30}$/;
const MAX_GENERATION_ATTEMPTS = 5;

function createUniqueShortCode(): string {
  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
    const code = generateShortCode();
    if (!RESERVED_SHORT_CODES.has(code) && !shortCodeExists(db, code)) {
      return code;
    }
  }

  throw new Error("No se pudo generar un código corto único tras varios intentos.");
}

function toResponseBody(record: UrlRecord): UrlRecord & { shortUrl: string } {
  return { ...record, shortUrl: `${config.baseUrl}/${record.shortCode}` };
}

export const urlsRouter = Router();

urlsRouter.post("/", authenticate, (req: Request, res: Response) => {
  const body = req.body as { url?: unknown; alias?: unknown } | undefined;
  const originalUrl = body?.url;
  const aliasInput = body?.alias;

  if (typeof originalUrl !== "string" || originalUrl.trim() === "") {
    res.status(400).json({ error: 'El campo "url" es obligatorio y debe ser un string.' });
    return;
  }

  try {
    new URL(originalUrl);
  } catch {
    res.status(400).json({
      error: 'El campo "url" debe ser una URL absoluta válida (incluyendo protocolo, p. ej. https://).',
    });
    return;
  }

  let shortCode: string;

  if (aliasInput !== undefined && aliasInput !== "") {
    if (typeof aliasInput !== "string" || !ALIAS_PATTERN.test(aliasInput)) {
      res.status(400).json({
        error: "El alias debe tener entre 3 y 30 caracteres (letras, números, - o _).",
      });
      return;
    }
    if (RESERVED_SHORT_CODES.has(aliasInput)) {
      res.status(400).json({ error: "Este alias está reservado. Elige otro." });
      return;
    }
    if (shortCodeExists(db, aliasInput)) {
      res.status(409).json({ error: "Este alias ya está en uso. Elige otro." });
      return;
    }
    shortCode = aliasInput;
  } else {
    shortCode = createUniqueShortCode();
  }

  const record = insertUrl(db, shortCode, originalUrl, req.user!.id);
  res.status(201).json(toResponseBody(record));
});

urlsRouter.get("/", (_req: Request, res: Response) => {
  res.status(200).json(listUrls(db).map(toResponseBody));
});

urlsRouter.get("/stats", (_req: Request, res: Response) => {
  res.status(200).json(getTopUrls(db));
});

urlsRouter.get("/mine", authenticate, (req: Request, res: Response) => {
  res.status(200).json(
    listUrlsByUser(db, req.user!.id).map(u => ({ ...u, shortUrl: `${config.baseUrl}/${u.shortCode}` })),
  );
});

urlsRouter.get("/:id/stats", (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "ID de URL inválido." });
    return;
  }

  const record = findUrlById(db, id);
  if (!record) {
    res.status(404).json({ error: "URL no encontrada." });
    return;
  }

  res.status(200).json({
    url: toResponseBody(record),
    stats: getUrlClickStats(db, id),
  });
});

urlsRouter.delete("/:id", authenticate, (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "ID de URL inválido." });
    return;
  }

  const record = findUrlById(db, id);
  if (!record) {
    res.status(404).json({ error: "URL no encontrada." });
    return;
  }

  if (record.userId !== req.user!.id) {
    res.status(403).json({ error: "No tienes permiso para eliminar esta URL." });
    return;
  }

  deleteUrlById(db, id);
  res.status(204).end();
});

export function redirectToOriginalUrl(req: Request, res: Response, next: NextFunction): void {
  const code = req.params.code;
  const record = typeof code === "string" ? findUrlByShortCode(db, code) : undefined;

  if (!record) {
    next();
    return;
  }

  insertClick(
    db,
    record.id,
    req.ip ?? null,
    (req.headers["user-agent"] as string | undefined) ?? null,
    (req.headers["referer"] as string | undefined) ?? null,
  );

  res.redirect(302, record.originalUrl);
}