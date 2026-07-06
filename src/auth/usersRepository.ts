import type Database from "better-sqlite3";

export interface UserRecord {
  readonly id: number;
  readonly email: string;
  readonly passwordHash: string;
  readonly name: string;
  readonly createdAt: string;
}

interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  name: string;
  created_at: string;
}

function toUserRecord(row: UserRow): UserRecord {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    name: row.name,
    createdAt: row.created_at,
  };
}

export function insertUser(
  db: Database.Database,
  email: string,
  passwordHash: string,
  name: string,
): UserRecord {
  const result = db
    .prepare("INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)")
    .run(email, passwordHash, name);

  const row = db
    .prepare<[number | bigint], UserRow>(
      "SELECT id, email, password_hash, name, created_at FROM users WHERE id = ?",
    )
    .get(result.lastInsertRowid);

  if (!row) {
    throw new Error("No se pudo leer el usuario recién insertado.");
  }

  return toUserRecord(row);
}

export function findUserByEmail(
  db: Database.Database,
  email: string,
): UserRecord | undefined {
  const row = db
    .prepare<[string], UserRow>(
      "SELECT id, email, password_hash, name, created_at FROM users WHERE email = ?",
    )
    .get(email);

  return row ? toUserRecord(row) : undefined;
}