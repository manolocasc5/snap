import type { Server } from "node:http";
import express from "express";
import jwt from "jsonwebtoken";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { authenticate } from "../src/auth/authMiddleware.js";
import { config } from "../src/config.js";

function createTestApp() {
  const testApp = express();
  testApp.get("/protected", authenticate, (req, res) => {
    res.status(200).json({ user: req.user });
  });
  return testApp;
}

function makeValidToken(overrides: Record<string, unknown> = {}): string {
  return jwt.sign({ sub: "42", email: "ana@example.com", ...overrides }, config.jwtSecret, {
    expiresIn: "1h",
  });
}

describe("authenticate middleware", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    server = await new Promise<Server>((resolve) => {
      const s = createTestApp().listen(0, () => resolve(s));
    });

    const address = server.address();
    if (address === null || typeof address === "string") {
      throw new Error("No se pudo obtener la dirección del servidor de pruebas");
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(() => {
    server.close();
  });

  it("permite el acceso con un token válido y adjunta el usuario a la request", async () => {
    const response = await fetch(`${baseUrl}/protected`, {
      headers: { Authorization: `Bearer ${makeValidToken()}` },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.user.id).toBe(42);
    expect(body.user.email).toBe("ana@example.com");
  });

  it("devuelve 401 si no hay header Authorization", async () => {
    const response = await fetch(`${baseUrl}/protected`);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(typeof body.error).toBe("string");
  });

  it("devuelve 401 si el scheme no es Bearer", async () => {
    const response = await fetch(`${baseUrl}/protected`, {
      headers: { Authorization: `Basic ${makeValidToken()}` },
    });

    expect(response.status).toBe(401);
  });

  it("devuelve 401 con un token malformado", async () => {
    const response = await fetch(`${baseUrl}/protected`, {
      headers: { Authorization: "Bearer esto.no.es.un.jwt.valido" },
    });

    expect(response.status).toBe(401);
  });

  it("devuelve 401 con un token firmado con un secreto diferente", async () => {
    const tokenOtroSecreto = jwt.sign(
      { sub: "42", email: "ana@example.com" },
      "secreto-diferente",
      { expiresIn: "1h" },
    );

    const response = await fetch(`${baseUrl}/protected`, {
      headers: { Authorization: `Bearer ${tokenOtroSecreto}` },
    });

    expect(response.status).toBe(401);
  });

  it("devuelve 401 con un token expirado", async () => {
    const expiredToken = jwt.sign(
      { sub: "42", email: "ana@example.com", exp: Math.floor(Date.now() / 1000) - 3600 },
      config.jwtSecret,
    );

    const response = await fetch(`${baseUrl}/protected`, {
      headers: { Authorization: `Bearer ${expiredToken}` },
    });

    expect(response.status).toBe(401);
  });
});