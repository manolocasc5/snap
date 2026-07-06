import type Database from "better-sqlite3";

export interface UrlRecord {
  readonly id: number;
  readonly shortCode: string;
  readonly originalUrl: string;
  readonly userId: number;
  readonly createdAt: string;
}

interface UrlRow {
  id: number;
  short_code: string;
  original_url: string;
  user_id: number;
  created_at: string;
}

function toUrlRecord(row: UrlRow): UrlRecord {
  return {
    id: row.id,
    shortCode: row.short_code,
    originalUrl: row.original_url,
    userId: row.user_id,
    createdAt: row.created_at,
  };
}

export function insertUrl(
  db: Database.Database,
  shortCode: string,
  originalUrl: string,
  userId: number,
): UrlRecord {
  const result = db
    .prepare("INSERT INTO urls (short_code, original_url, user_id) VALUES (?, ?, ?)")
    .run(shortCode, originalUrl, userId);

  const row = db
    .prepare<[number | bigint], UrlRow>(
      "SELECT id, short_code, original_url, user_id, created_at FROM urls WHERE id = ?",
    )
    .get(result.lastInsertRowid);

  if (!row) {
    throw new Error("No se pudo leer la URL recién insertada.");
  }

  return toUrlRecord(row);
}

export function findUrlByShortCode(db: Database.Database, shortCode: string): UrlRecord | undefined {
  const row = db
    .prepare<[string], UrlRow>(
      "SELECT id, short_code, original_url, user_id, created_at FROM urls WHERE short_code = ?",
    )
    .get(shortCode);

  return row ? toUrlRecord(row) : undefined;
}

export function findUrlById(db: Database.Database, id: number): UrlRecord | undefined {
  const row = db
    .prepare<[number], UrlRow>(
      "SELECT id, short_code, original_url, user_id, created_at FROM urls WHERE id = ?",
    )
    .get(id);

  return row ? toUrlRecord(row) : undefined;
}

export function shortCodeExists(db: Database.Database, shortCode: string): boolean {
  const row = db.prepare<[string]>("SELECT 1 FROM urls WHERE short_code = ?").get(shortCode);
  return row !== undefined;
}

export function deleteUrlById(db: Database.Database, id: number): void {
  db.prepare("DELETE FROM urls WHERE id = ?").run(id);
}

export function listUrls(db: Database.Database): UrlRecord[] {
  const rows = db
    .prepare<[], UrlRow>(
      "SELECT id, short_code, original_url, user_id, created_at FROM urls ORDER BY id DESC",
    )
    .all();

  return rows.map(toUrlRecord);
}