import type Database from "better-sqlite3";
import { beforeEach, describe, expect, it } from "vitest";
import { createDatabase } from "../src/db/database.js";
import {
  deleteUrlById,
  findUrlById,
  findUrlByShortCode,
  insertUrl,
  listUrls,
  listUrlsByUser,
  shortCodeExists,
} from "../src/urls/urlsRepository.js";

const USER_ID = 1;

describe("urlsRepository", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createDatabase(":memory:");
    db.prepare("INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)").run(
      "test@example.com",
      "hash",
      "Test",
    );
  });

  it("insertUrl guarda la URL y devuelve el registro creado", () => {
    const record = insertUrl(db, "abc1234", "https://example.com", USER_ID);

    expect(record).toMatchObject({
      shortCode: "abc1234",
      originalUrl: "https://example.com",
      userId: USER_ID,
    });
    expect(typeof record.id).toBe("number");
    expect(typeof record.createdAt).toBe("string");
  });

  it("findUrlByShortCode encuentra una URL existente y no encuentra una inexistente", () => {
    insertUrl(db, "abc1234", "https://example.com", USER_ID);

    expect(findUrlByShortCode(db, "abc1234")).toMatchObject({ originalUrl: "https://example.com" });
    expect(findUrlByShortCode(db, "no-existe")).toBeUndefined();
  });

  it("findUrlById encuentra una URL existente y no encuentra una inexistente", () => {
    const inserted = insertUrl(db, "abc1234", "https://example.com", USER_ID);

    expect(findUrlById(db, inserted.id)).toMatchObject({ shortCode: "abc1234" });
    expect(findUrlById(db, 9999)).toBeUndefined();
  });

  it("shortCodeExists refleja si el código ya está en uso", () => {
    insertUrl(db, "abc1234", "https://example.com", USER_ID);

    expect(shortCodeExists(db, "abc1234")).toBe(true);
    expect(shortCodeExists(db, "otro-codigo")).toBe(false);
  });

  it("deleteUrlById elimina la URL", () => {
    const record = insertUrl(db, "abc1234", "https://example.com", USER_ID);

    deleteUrlById(db, record.id);

    expect(findUrlById(db, record.id)).toBeUndefined();
  });

  it("listUrls devuelve todas las URLs creadas, más recientes primero", () => {
    insertUrl(db, "primero", "https://uno.example.com", USER_ID);
    insertUrl(db, "segundo", "https://dos.example.com", USER_ID);

    const records = listUrls(db);

    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({ shortCode: "segundo" });
    expect(records[1]).toMatchObject({ shortCode: "primero" });
  });

  describe("listUrlsByUser", () => {
    const OTHER_USER_ID = 2;

    beforeEach(() => {
      db.prepare("INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)").run(
        OTHER_USER_ID,
        "other@example.com",
        "hash",
        "Other",
      );
    });

    it("devuelve solo las URLs del usuario indicado", () => {
      insertUrl(db, "mia", "https://mia.example.com", USER_ID);
      insertUrl(db, "ajena", "https://ajena.example.com", OTHER_USER_ID);

      const records = listUrlsByUser(db, USER_ID);

      expect(records).toHaveLength(1);
      expect(records[0]).toMatchObject({ shortCode: "mia", userId: USER_ID });
    });

    it("incluye el contador de clicks en cada URL", () => {
      const url = insertUrl(db, "conclicks", "https://example.com", USER_ID);
      db.prepare("INSERT INTO clicks (url_id) VALUES (?)").run(url.id);
      db.prepare("INSERT INTO clicks (url_id) VALUES (?)").run(url.id);

      const records = listUrlsByUser(db, USER_ID);

      expect(records[0].clicks).toBe(2);
    });

    it("devuelve 0 clicks para URLs sin visitas", () => {
      insertUrl(db, "sinclicks", "https://example.com", USER_ID);

      const records = listUrlsByUser(db, USER_ID);

      expect(records[0].clicks).toBe(0);
    });

    it("devuelve array vacío si el usuario no tiene URLs", () => {
      expect(listUrlsByUser(db, OTHER_USER_ID)).toHaveLength(0);
    });
  });
});