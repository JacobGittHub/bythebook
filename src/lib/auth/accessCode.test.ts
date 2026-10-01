import { describe, expect, it } from "vitest";
import { generateAccessCode, hashAccessCode, normalizeAccessCode } from "./accessCode";

describe("generateAccessCode", () => {
  it("makes four dash-separated groups of five unambiguous characters", () => {
    for (let run = 0; run < 200; run++) {
      expect(generateAccessCode()).toMatch(/^([2-9A-HJKMNP-TV-Z]{5}-){3}[2-9A-HJKMNP-TV-Z]{5}$/);
    }
  });

  it("does not repeat", () => {
    const codes = new Set(Array.from({ length: 1000 }, generateAccessCode));
    expect(codes.size).toBe(1000);
  });
});

describe("hashAccessCode", () => {
  it("is the same however the code is typed", () => {
    const code = generateAccessCode();
    const hash = hashAccessCode(code);
    expect(hashAccessCode(code.toLowerCase())).toBe(hash);
    expect(hashAccessCode(` ${code.replaceAll("-", " ")} `)).toBe(hash);
    expect(hashAccessCode(normalizeAccessCode(code))).toBe(hash);
  });

  it("differs between codes and never contains the code", () => {
    const code = generateAccessCode();
    expect(hashAccessCode(code)).not.toBe(hashAccessCode(generateAccessCode()));
    expect(hashAccessCode(code)).toMatch(/^[0-9a-f]{64}$/);
  });
});
