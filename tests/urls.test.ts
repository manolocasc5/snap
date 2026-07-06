import type { Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { config } from "../src/config.js";
import { db } from "../src/db/database.js";

async function registerAndGetToken(
  baseUrl: string,
  email: string,
  password = "password123",
  name = "Test",
): Promise<string> {
  const res = await fetch(`${baseUrl}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name }),
  });
  const body = await res.json();
  return body.token as string;
}

describe("Funcionalidad core de URLs", () => {
  let server: Server;
  let baseUrl: string;
  let authToken: string;
  let otherToken: string;

  beforeAll(async () => {
    server = await new Promise<Server>((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });

    const address = server.address();
    if (address === null || typeof address === "string") {
      throw new Error("No se pudo obtener la dirección del servidor de pruebas");
    }
    baseUrl = `http://127.0.0.1:${address.port}`;

    authToken = await registerAndGetToken(baseUrl, "owner@example.com");
    otherToken = await registerAndGetToken(baseUrl, "other@example.com");
  });

  beforeEach(() => {
    db.exec("DELETE FROM urls");
  });

  afterAll(() => {
    server.close();
  });

  it("POST /urls crea una URL corta a partir de una URL larga válida", async () => {
    const response = await fetch(`${baseUrl}/urls`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ url: "https://example.com/articulo-muy-largo" }),
    });

    expect(response.status).toBe(201);

    const body = await response.json();
    expect(body.originalUrl).toBe("https://example.com/articulo-muy-largo");
    expect(body.shortCode).toMatch(/^[A-Za-z0-9]{7}$/);
    expect(body.shortUrl).toBe(`${config.baseUrl}/${body.shortCode}`);
    expect(typeof body.id).toBe("number");
  });

  describe("POST /urls con alias", () => {
    it("crea la URL con el alias proporcionado", async () => {
      const response = await fetch(`${baseUrl}/urls`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ url: "https://example.com", alias: "mi-alias" }),
      });

      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.shortCode).toBe("mi-alias");
    });

    it("devuelve 409 si el alias ya está en uso", async () => {
      await fetch(`${baseUrl}/urls`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ url: "https://example.com", alias: "duplicado" }),
      });

      const response = await fetch(`${baseUrl}/urls`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ url: "https://otro.com", alias: "duplicado" }),
      });

      expect(response.status).toBe(409);
      const body = await response.json();
      expect(body.error).toMatch(/alias/i);
    });

    it("devuelve 400 si el alias es demasiado corto", async () => {
      const response = await fetch(`${baseUrl}/urls`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ url: "https://example.com", alias: "ab" }),
      });

      expect(response.status).toBe(400);
    });

    it("devuelve 400 si el alias es una palabra reservada", async () => {
      const response = await fetch(`${baseUrl}/urls`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ url: "https://example.com", alias: "health" }),
      });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toMatch(/reservado/i);
    });

    it("ignora el alias si se pasa vacío (genera código automático)", async () => {
      const response = await fetch(`${baseUrl}/urls`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ url: "https://example.com", alias: "" }),
      });

      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.shortCode).toMatch(/^[A-Za-z0-9]{7}$/);
    });
  });

  describe("GET /urls/mine", () => {
    it("devuelve solo las URLs del usuario autenticado", async () => {
      await fetch(`${baseUrl}/urls`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ url: "https://mia.example.com" }),
      });
      await fetch(`${baseUrl}/urls`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${otherToken}` },
        body: JSON.stringify({ url: "https://ajena.example.com" }),
      });

      const response = await fetch(`${baseUrl}/urls/mine`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toHaveLength(1);
      expect(body[0].originalUrl).toBe("https://mia.example.com");
      expect(typeof body[0].clicks).toBe("number");
      expect(typeof body[0].shortUrl).toBe("string");
    });

    it("devuelve 401 sin token", async () => {
      const response = await fetch(`${baseUrl}/urls/mine`);
      expect(response.status).toBe(401);
    });
  });

  it("POST /urls sin campo url devuelve 400", async () => {
    const response = await fetch(`${baseUrl}/urls`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(400);
  });

  it("POST /urls con una URL mal formada devuelve 400", async () => {
    const response = await fetch(`${baseUrl}/urls`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ url: "no-es-una-url" }),
    });

    expect(response.status).toBe(400);
  });

  it("POST /urls sin autenticación devuelve 401", async () => {
    const response = await fetch(`${baseUrl}/urls`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com" }),
    });

    expect(response.status).toBe(401);
  });

  it("GET /urls lista todas las URLs creadas", async () => {
    await fetch(`${baseUrl}/urls`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ url: "https://uno.example.com" }),
    });
    await fetch(`${baseUrl}/urls`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ url: "https://dos.example.com" }),
    });

    const response = await fetch(`${baseUrl}/urls`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toHaveLength(2);
    const originalUrls = body.map((record: { originalUrl: string }) => record.originalUrl);
    expect(originalUrls).toContain("https://uno.example.com");
    expect(originalUrls).toContain("https://dos.example.com");
  });

  it("GET /:shortCode redirige (302) a la URL original", async () => {
    const createResponse = await fetch(`${baseUrl}/urls`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ url: "https://destino.example.com/pagina" }),
    });
    const { shortCode } = await createResponse.json();

    const redirectResponse = await fetch(`${baseUrl}/${shortCode}`, { redirect: "manual" });

    expect(redirectResponse.status).toBe(302);
    expect(redirectResponse.headers.get("location")).toBe("https://destino.example.com/pagina");
  });

  it("GET /:shortCode con un código inexistente devuelve 404", async () => {
    const response = await fetch(`${baseUrl}/codigo-que-no-existe`);

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe("Ruta no encontrada");
  });

  describe("DELETE /urls/:id", () => {
    it("elimina la URL propia y devuelve 204", async () => {
      const createResponse = await fetch(`${baseUrl}/urls`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ url: "https://example.com/a-borrar" }),
      });
      const { id } = await createResponse.json();

      const deleteResponse = await fetch(`${baseUrl}/urls/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(deleteResponse.status).toBe(204);
    });

    it("devuelve 404 si la URL no existe", async () => {
      const response = await fetch(`${baseUrl}/urls/99999`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(response.status).toBe(404);
    });

    it("devuelve 403 si la URL pertenece a otro usuario", async () => {
      const createResponse = await fetch(`${baseUrl}/urls`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ url: "https://example.com/ajena" }),
      });
      const { id } = await createResponse.json();

      const deleteResponse = await fetch(`${baseUrl}/urls/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${otherToken}` },
      });

      expect(deleteResponse.status).toBe(403);
    });

    it("devuelve 401 sin autenticación", async () => {
      const response = await fetch(`${baseUrl}/urls/1`, {
        method: "DELETE",
      });

      expect(response.status).toBe(401);
    });
  });
});