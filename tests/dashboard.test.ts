import type { Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
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

async function createUrl(baseUrl: string, token: string, url: string): Promise<{ id: number; shortCode: string }> {
  const res = await fetch(`${baseUrl}/urls`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ url }),
  });
  return res.json() as Promise<{ id: number; shortCode: string }>;
}

describe("GET /dashboard", () => {
  let server: Server;
  let baseUrl: string;
  let tokenA: string;
  let tokenB: string;

  beforeAll(async () => {
    server = await new Promise<Server>((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });

    const address = server.address();
    if (address === null || typeof address === "string") {
      throw new Error("No se pudo obtener la dirección del servidor de pruebas");
    }
    baseUrl = `http://127.0.0.1:${address.port}`;

    tokenA = await registerAndGetToken(baseUrl, "alice@example.com");
    tokenB = await registerAndGetToken(baseUrl, "bob@example.com");
  });

  beforeEach(() => {
    db.exec("DELETE FROM clicks");
    db.exec("DELETE FROM urls");
  });

  afterAll(() => {
    server.close();
  });

  it("devuelve 401 sin token", async () => {
    const res = await fetch(`${baseUrl}/dashboard`);
    expect(res.status).toBe(401);
  });

  it("devuelve 401 con token inválido", async () => {
    const res = await fetch(`${baseUrl}/dashboard`, {
      headers: { Authorization: "Bearer token-falso" },
    });
    expect(res.status).toBe(401);
  });

  it("devuelve totales en cero y arrays vacíos cuando el usuario no tiene URLs", async () => {
    const res = await fetch(`${baseUrl}/dashboard`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.summary.totalUrls).toBe(0);
    expect(body.summary.totalClicks).toBe(0);
    expect(body.summary.topUrl).toBeNull();
    expect(body.trends.clicksThisWeek).toBe(0);
    expect(body.trends.clicksLastWeek).toBe(0);
    expect(body.trends.changePercent).toBeNull();
    expect(body.trends.clicksByDay).toEqual([]);
    expect(body.trends.urlsCreatedByWeek).toEqual([]);
  });

  it("con URLs pero sin clicks, totalClicks es 0 y changePercent es null", async () => {
    await createUrl(baseUrl, tokenA, "https://example.com/a");
    await createUrl(baseUrl, tokenA, "https://example.com/b");

    const res = await fetch(`${baseUrl}/dashboard`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.summary.totalUrls).toBe(2);
    expect(body.summary.totalClicks).toBe(0);
    expect(body.summary.topUrl).not.toBeNull();
    expect(body.summary.topUrl.clicks).toBe(0);
    expect(body.trends.changePercent).toBeNull();
    expect(body.trends.urlsCreatedByWeek).toHaveLength(1);
    expect(body.trends.urlsCreatedByWeek[0].urlsCreated).toBe(2);
  });

  it("con URLs y clicks, devuelve totales y tendencias correctas", async () => {
    const { shortCode } = await createUrl(baseUrl, tokenA, "https://example.com/popular");

    // Simula 3 clicks visitando el short code
    for (let i = 0; i < 3; i++) {
      await fetch(`${baseUrl}/${shortCode}`, { redirect: "manual" });
    }

    const res = await fetch(`${baseUrl}/dashboard`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.summary.totalClicks).toBe(3);
    expect(body.summary.topUrl.shortCode).toBe(shortCode);
    expect(body.summary.topUrl.clicks).toBe(3);
    expect(body.trends.clicksThisWeek).toBe(3);
    expect(body.trends.clicksByDay).toHaveLength(1);
    expect(body.trends.clicksByDay[0].clicks).toBe(3);
  });

  it("el dashboard de usuario A no incluye datos de usuario B", async () => {
    await createUrl(baseUrl, tokenA, "https://example.com/de-a");
    const { shortCode: codeB } = await createUrl(baseUrl, tokenB, "https://example.com/de-b");

    // B recibe 5 clicks
    for (let i = 0; i < 5; i++) {
      await fetch(`${baseUrl}/${codeB}`, { redirect: "manual" });
    }

    const res = await fetch(`${baseUrl}/dashboard`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });

    const body = await res.json();

    // A tiene 1 URL y 0 clicks — no ve los 5 clicks de B
    expect(body.summary.totalUrls).toBe(1);
    expect(body.summary.totalClicks).toBe(0);
    expect(body.trends.clicksThisWeek).toBe(0);
  });
});
