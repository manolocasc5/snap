import { describe, expect, it } from "vitest";
import { generateShortCode } from "../src/urls/shortCode.js";

describe("generateShortCode", () => {
  it("genera un código de 7 caracteres alfanuméricos", () => {
    const code = generateShortCode();

    expect(code).toMatch(/^[A-Za-z0-9]{7}$/);
  });

  it("genera códigos distintos en llamadas sucesivas", () => {
    const codes = new Set(Array.from({ length: 50 }, () => generateShortCode()));

    expect(codes.size).toBe(50);
  });
});