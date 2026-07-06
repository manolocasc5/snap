import type { Server } from "node:http";
import express from "express";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { app, errorHandler } from "../src/app.js";

async function listenOnEphemeralPort(server: import("express").Express): Promise<{
  server: Server;
  baseUrl: string;
}> {
  const httpServer = await new Promise<Server>((resolve) => {
    const s = server.listen(0, () => resolve(s));
  });

  const address = httpServer.address();
  if (address === null || typeof address === "string") {
    throw new Error("No se pudo obtener la dirección del servidor de pruebas");
  }

  return { server: httpServer, baseUrl: `http://127.0.0.1:${address.port}` };
}

describe("404 - rutas no encontradas", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    ({ server, baseUrl } = await listenOnEphemeralPort(app));
  });

  afterAll(() => {
    server.close();
  });

  it("responde 404 con JSON al pedir una ruta inexistente", async () => {
    const response = await fetch(`${baseUrl}/esto-no-existe`);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "Ruta no encontrada",
      path: "/esto-no-existe",
    });
  });

  it("no afecta al endpoint /health existente", async () => {
    const response = await fetch(`${baseUrl}/health`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });
});

describe("500 - errores inesperados", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  function createThrowingApp() {
    const testApp = express();
    testApp.get("/explode-sync", () => {
      throw new Error("boom síncrono");
    });
    testApp.get("/explode-async", async () => {
      throw new Error("boom asíncrono");
    });
    testApp.get("/ping", (_req, res) => {
      res.status(200).json({ pong: true });
    });
    testApp.use(errorHandler);
    return testApp;
  }

  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    ({ server, baseUrl } = await listenOnEphemeralPort(createThrowingApp()));
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  afterAll(() => {
    server.close();
  });

  it("captura una excepción síncrona y responde 500 sin tirar el servidor", async () => {
    const response = await fetch(`${baseUrl}/explode-sync`);
    expect(response.status).toBe(500);

    const survivor = await fetch(`${baseUrl}/ping`);
    expect(survivor.status).toBe(200);
    await expect(survivor.json()).resolves.toEqual({ pong: true });
  });

  it("captura un rechazo de promesa (handler async) y responde 500 sin tirar el servidor", async () => {
    const response = await fetch(`${baseUrl}/explode-async`);
    expect(response.status).toBe(500);

    const survivor = await fetch(`${baseUrl}/ping`);
    expect(survivor.status).toBe(200);
  });

  it("en producción no expone el mensaje original del error", async () => {
    process.env.NODE_ENV = "production";

    const response = await fetch(`${baseUrl}/explode-sync`);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: "Error interno del servidor" });
  });

  it("fuera de producción incluye el mensaje original del error", async () => {
    process.env.NODE_ENV = "development";

    const response = await fetch(`${baseUrl}/explode-sync`);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      error: "Error interno del servidor",
      message: "boom síncrono",
    });
  });
});