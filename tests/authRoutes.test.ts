import type { Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { db } from "../src/db/database.js";

const VALID_USER = {
  email: "ana@example.com",
  password: "password123",
  name: "Ana",
};

async function registerUser(
  baseUrl: string,
  data: { email: string; password: string; name: string } = VALID_USER,
) {
  return fetch(`${baseUrl}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

describe("Auth routes", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    server = await new Promise<Server>((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });

    const address = server.address();
    if (address === null || typeof address === "string") {
      throw new Error("No se pudo obtener la dirección del servidor de pruebas");
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  beforeEach(() => {
    db.exec("DELETE FROM users");
  });

  afterAll(() => {
    server.close();
  });

  describe("POST /auth/register", () => {
    it("crea un usuario y devuelve 201 con token y datos del usuario", async () => {
      const response = await registerUser(baseUrl);

      expect(response.status).toBe(201);
      const body = await response.json();
      expect(typeof body.token).toBe("string");
      expect(body.token.split(".")).toHaveLength(3);
      expect(body.user.email).toBe("ana@example.com");
      expect(body.user.name).toBe("Ana");
      expect(typeof body.user.id).toBe("number");
      expect(typeof body.user.createdAt).toBe("string");
    });

    it("no incluye passwordHash en la respuesta", async () => {
      const response = await registerUser(baseUrl);

      const body = await response.json();
      expect(body.user).not.toHaveProperty("passwordHash");
      expect(body.user).not.toHaveProperty("password_hash");
    });

    it("normaliza el email a minúsculas", async () => {
      const response = await registerUser(baseUrl, {
        email: "ANA@EXAMPLE.COM",
        password: "password123",
        name: "Ana",
      });

      const body = await response.json();
      expect(body.user.email).toBe("ana@example.com");
    });

    it("devuelve 409 si el email ya está registrado", async () => {
      await registerUser(baseUrl);
      const response = await registerUser(baseUrl);

      expect(response.status).toBe(409);
      const body = await response.json();
      expect(typeof body.error).toBe("string");
    });

    it("devuelve 409 sin distinguir mayúsculas en el email duplicado", async () => {
      await registerUser(baseUrl);
      const response = await registerUser(baseUrl, {
        email: "ANA@EXAMPLE.COM",
        password: "otropassword",
        name: "Ana 2",
      });

      expect(response.status).toBe(409);
    });

    it("devuelve 400 si el email tiene formato inválido", async () => {
      const response = await registerUser(baseUrl, {
        email: "no-es-un-email",
        password: "password123",
        name: "Ana",
      });

      expect(response.status).toBe(400);
    });

    it("devuelve 400 si el password es demasiado corto", async () => {
      const response = await registerUser(baseUrl, {
        email: "ana@example.com",
        password: "corto",
        name: "Ana",
      });

      expect(response.status).toBe(400);
    });

    it("devuelve 400 si falta el nombre", async () => {
      const response = await fetch(`${baseUrl}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "ana@example.com", password: "password123" }),
      });

      expect(response.status).toBe(400);
    });

    it("devuelve 400 si el body está vacío", async () => {
      const response = await fetch(`${baseUrl}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(400);
    });
  });

  describe("POST /auth/login", () => {
    beforeEach(async () => {
      await registerUser(baseUrl);
    });

    it("devuelve 200 con token y datos del usuario con credenciales correctas", async () => {
      const response = await fetch(`${baseUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: VALID_USER.email, password: VALID_USER.password }),
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(typeof body.token).toBe("string");
      expect(body.token.split(".")).toHaveLength(3);
      expect(body.user.email).toBe("ana@example.com");
      expect(body.user.name).toBe("Ana");
    });

    it("no incluye passwordHash en la respuesta", async () => {
      const response = await fetch(`${baseUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: VALID_USER.email, password: VALID_USER.password }),
      });

      const body = await response.json();
      expect(body.user).not.toHaveProperty("passwordHash");
      expect(body.user).not.toHaveProperty("password_hash");
    });

    it("acepta el email en mayúsculas", async () => {
      const response = await fetch(`${baseUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "ANA@EXAMPLE.COM", password: VALID_USER.password }),
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.user.email).toBe("ana@example.com");
    });

    it("devuelve 401 si el password es incorrecto", async () => {
      const response = await fetch(`${baseUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: VALID_USER.email, password: "password-incorrecto" }),
      });

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(typeof body.error).toBe("string");
    });

    it("devuelve 401 si el email no existe", async () => {
      const response = await fetch(`${baseUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "noexiste@example.com", password: VALID_USER.password }),
      });

      expect(response.status).toBe(401);
    });

    it("devuelve 400 si falta el password", async () => {
      const response = await fetch(`${baseUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: VALID_USER.email }),
      });

      expect(response.status).toBe(400);
    });

    it("devuelve 400 si el body está vacío", async () => {
      const response = await fetch(`${baseUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(400);
    });
  });
});