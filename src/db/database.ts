import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { config } from "../config.js";

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS urls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    short_code TEXT NOT NULL UNIQUE,
    original_url TEXT NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS clicks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url_id INTEGER NOT NULL REFERENCES urls(id) ON DELETE CASCADE,
    clicked_at TEXT NOT NULL DEFAULT (datetime('now')),
    ip_address TEXT,
    user_agent TEXT,
    referer TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_urls_user_id
    ON urls(user_id);

  CREATE INDEX IF NOT EXISTS idx_clicks_url_id_clicked_at
    ON clicks(url_id, clicked_at);

  CREATE INDEX IF NOT EXISTS idx_urls_user_id_created_at
    ON urls(user_id, created_at);
`;

function runMigrations(db: Database.Database): void {
  const urlCols = db.prepare("PRAGMA table_info(urls)").all() as Array<{ name: string }>;
  if (!urlCols.some((col) => col.name === "user_id")) {
    // ALTER TABLE no permite NOT NULL sin DEFAULT; la restricción se aplica en el INSERT
    db.exec("ALTER TABLE urls ADD COLUMN user_id INTEGER REFERENCES users(id)");
  }
}

export function createDatabase(filePath: string): Database.Database {
  const db = new Database(filePath);
  // WAL permite lecturas concurrentes durante escrituras (evita bloqueos en redirects simultáneos)
  db.pragma("journal_mode = WAL");
  db.exec(SCHEMA);
  runMigrations(db);
  return db;
}

function resolveDbPath(): string {
  if (config.nodeEnv === "test") {
    return ":memory:";
  }

  const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
  const dataDir = path.join(projectRoot, "data");
  mkdirSync(dataDir, { recursive: true });

  return path.join(dataDir, config.dbName);
}

export const db: Database.Database = createDatabase(resolveDbPath());