import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createDatabase } from "../src/db/database.js";

describe("createDatabase", () => {
  it("crea la tabla urls con las columnas esperadas", () => {
    const db = createDatabase(":memory:");

    const columns = db
      .prepare("PRAGMA table_info(urls)")
      .all() as Array<{ name: string }>;

    expect(columns.map((column) => column.name)).toEqual([
      "id",
      "short_code",
      "original_url",
      "user_id",
      "created_at",
    ]);

    db.close();
  });

  it("crea la tabla users con las columnas esperadas", () => {
    const db = createDatabase(":memory:");

    const columns = db
      .prepare("PRAGMA table_info(users)")
      .all() as Array<{ name: string }>;

    expect(columns.map((column) => column.name)).toEqual([
      "id",
      "email",
      "password_hash",
      "name",
      "created_at",
    ]);

    db.close();
  });

  it("crea la tabla clicks con las columnas esperadas", () => {
    const db = createDatabase(":memory:");

    const columns = db
      .prepare("PRAGMA table_info(clicks)")
      .all() as Array<{ name: string }>;

    expect(columns.map((c) => c.name)).toEqual([
      "id",
      "url_id",
      "clicked_at",
      "ip_address",
      "user_agent",
      "referer",
    ]);

    db.close();
  });

  it("crea los índices de rendimiento sobre urls y clicks", () => {
    const db = createDatabase(":memory:");

    const indices = db
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'")
      .all() as Array<{ name: string }>;

    const names = indices.map((i) => i.name);
    expect(names).toContain("idx_urls_user_id");
    expect(names).toContain("idx_clicks_url_id_clicked_at");
    expect(names).toContain("idx_urls_user_id_created_at");

    db.close();
  });

  it("usa WAL como modo de journal en bases de datos de fichero", () => {
    const filePath = join(tmpdir(), `snap-test-wal-${Date.now()}.db`);
    const db = createDatabase(filePath);

    const result = db.pragma("journal_mode") as Array<{ journal_mode: string }>;
    expect(result[0].journal_mode).toBe("wal");

    db.close();
    rmSync(filePath, { force: true });
  });

  it("no permite short_code duplicados", () => {
    const db = createDatabase(":memory:");

    db.prepare("INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)").run(
      "test@example.com",
      "hash",
      "Test",
    );
    db.prepare("INSERT INTO urls (short_code, original_url, user_id) VALUES (?, ?, ?)").run(
      "abc1234",
      "https://example.com",
      1,
    );

    expect(() =>
      db
        .prepare("INSERT INTO urls (short_code, original_url, user_id) VALUES (?, ?, ?)")
        .run("abc1234", "https://otro-ejemplo.com", 1),
    ).toThrow();

    db.close();
  });
});