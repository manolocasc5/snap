import type Database from "better-sqlite3";
import jwt from "jsonwebtoken";
import { beforeEach, describe, expect, it } from "vitest";
import { AuthError, login, register } from "../src/auth/authService.js";
import { config } from "../src/config.js";
import { createDatabase } from "../src/db/database.js";

describe("authService", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createDatabase(":memory:");
  });

  describe("register", () => {
    it("crea un usuario y devuelve un JWT válido", async () => {
      const result = await register(db, "ana@example.com", "password123", "Ana");

      expect(typeof result.token).toBe("string");
      const payload = jwt.verify(result.token, config.jwtSecret) as jwt.JwtPayload;
      expect(payload.email).toBe("ana@example.com");
      expect(typeof payload.sub).toBe("string");
    });

    it("devuelve los datos públicos del usuario sin passwordHash", async () => {
      const result = await register(db, "ana@example.com", "password123", "Ana");

      expect(result.user.email).toBe("ana@example.com");
      expect(result.user.name).toBe("Ana");
      expect(typeof result.user.id).toBe("number");
      expect(typeof result.user.createdAt).toBe("string");
      expect(result.user).not.toHaveProperty("passwordHash");
    });

    it("normaliza el email a minúsculas al registrar", async () => {
      const result = await register(db, "ANA@EXAMPLE.COM", "password123", "Ana");

      const payload = jwt.verify(result.token, config.jwtSecret) as jwt.JwtPayload;
      expect(payload.email).toBe("ana@example.com");
      expect(result.user.email).toBe("ana@example.com");
    });

    it("lanza AuthError con código EMAIL_TAKEN si el email ya existe", async () => {
      await register(db, "ana@example.com", "password123", "Ana");

      await expect(register(db, "ana@example.com", "otro-password", "Ana 2")).rejects.toSatisfy(
        (err: unknown) => err instanceof AuthError && err.code === "EMAIL_TAKEN",
      );
    });

    it("trata el email duplicado sin distinguir mayúsculas", async () => {
      await register(db, "ana@example.com", "password123", "Ana");

      await expect(register(db, "ANA@EXAMPLE.COM", "otro-password", "Ana 2")).rejects.toSatisfy(
        (err: unknown) => err instanceof AuthError && err.code === "EMAIL_TAKEN",
      );
    });
  });

  describe("login", () => {
    beforeEach(async () => {
      await register(db, "ana@example.com", "password123", "Ana");
    });

    it("devuelve un JWT válido con las credenciales correctas", async () => {
      const result = await login(db, "ana@example.com", "password123");

      expect(typeof result.token).toBe("string");
      const payload = jwt.verify(result.token, config.jwtSecret) as jwt.JwtPayload;
      expect(payload.email).toBe("ana@example.com");
    });

    it("devuelve los datos públicos del usuario sin passwordHash", async () => {
      const result = await login(db, "ana@example.com", "password123");

      expect(result.user.email).toBe("ana@example.com");
      expect(result.user.name).toBe("Ana");
      expect(result.user).not.toHaveProperty("passwordHash");
    });

    it("el JWT expira en aproximadamente 24 horas", async () => {
      const result = await login(db, "ana@example.com", "password123");

      const payload = jwt.verify(result.token, config.jwtSecret) as jwt.JwtPayload;
      const expiresInSeconds = (payload.exp ?? 0) - (payload.iat ?? 0);
      expect(expiresInSeconds).toBe(24 * 60 * 60);
    });

    it("lanza AuthError con código INVALID_CREDENTIALS si el password es incorrecto", async () => {
      await expect(login(db, "ana@example.com", "password-malo")).rejects.toSatisfy(
        (err: unknown) => err instanceof AuthError && err.code === "INVALID_CREDENTIALS",
      );
    });

    it("lanza AuthError con código INVALID_CREDENTIALS si el email no existe", async () => {
      await expect(login(db, "noexiste@example.com", "password123")).rejects.toSatisfy(
        (err: unknown) => err instanceof AuthError && err.code === "INVALID_CREDENTIALS",
      );
    });

    it("acepta el email en mayúsculas al hacer login", async () => {
      const result = await login(db, "ANA@EXAMPLE.COM", "password123");

      const payload = jwt.verify(result.token, config.jwtSecret) as jwt.JwtPayload;
      expect(payload.email).toBe("ana@example.com");
    });
  });
});