import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ENV_KEYS = ["NODE_ENV", "PORT", "DB_NAME", "BASE_URL", "CORS_ORIGIN"] as const;
const originalEnv: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

beforeEach(() => {
  for (const key of ENV_KEYS) {
    originalEnv[key] = process.env[key];
    delete process.env[key];
  }
  vi.resetModules();
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = originalEnv[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  vi.resetModules();
});

describe("config - valores por defecto", () => {
  it("usa los valores por defecto cuando no hay variables de entorno configuradas", async () => {
    const { config } = await import("../src/config.js");

    expect(config).toEqual({
      port: 3000,
      nodeEnv: "development",
      dbName: "snap.db",
      baseUrl: "http://localhost:3000",
      jwtSecret: "dev-secret-not-for-production",
      corsOrigin: "http://localhost:5173",
    });
  });

  it("usa los valores de las variables de entorno cuando están presentes", async () => {
    process.env.NODE_ENV = "development";
    process.env.PORT = "8080";
    process.env.DB_NAME = "otra.db";
    process.env.BASE_URL = "http://localhost:8080";

    const { config } = await import("../src/config.js");

    expect(config).toEqual({
      port: 8080,
      nodeEnv: "development",
      dbName: "otra.db",
      baseUrl: "http://localhost:8080",
      jwtSecret: "dev-secret-not-for-production",
      corsOrigin: "http://localhost:5173",
    });
  });
});

describe("config - validación en producción", () => {
  it("lanza un error al cargar el módulo si falta BASE_URL en producción", async () => {
    process.env.NODE_ENV = "production";

    await expect(import("../src/config.js")).rejects.toThrow(/BASE_URL/);
  });

  it("no lanza error en producción si BASE_URL y JWT_SECRET están definidas", async () => {
    process.env.NODE_ENV = "production";
    process.env.BASE_URL = "https://snap.example.com";
    process.env.JWT_SECRET = "super-secret-production-key";

    const { config } = await import("../src/config.js");

    expect(config.nodeEnv).toBe("production");
    expect(config.baseUrl).toBe("https://snap.example.com");
  });
});