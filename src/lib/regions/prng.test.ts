import { describe, expect, it } from "vitest";
import { cyrb53, mulberry32, rngFor } from "./prng";

function take(rng: () => number, count: number) {
  return Array.from({ length: count }, () => rng());
}

describe("cyrb53", () => {
  it("matches the published reference values", () => {
    expect(cyrb53("a")).toBe(7929297801672961);
    expect(cyrb53("b")).toBe(8684336938537663);
    expect(cyrb53("revenge")).toBe(4051478007546757);
    expect(cyrb53("revenue")).toBe(8309097637345594);
  });

  it("changes with the seed", () => {
    expect(cyrb53("e2e4", 1)).not.toBe(cyrb53("e2e4", 2));
  });
});

describe("mulberry32", () => {
  it("repeats the same sequence for the same seed", () => {
    expect(take(mulberry32(42), 100)).toEqual(take(mulberry32(42), 100));
  });

  it("returns values in [0, 1) that average about one half", () => {
    const values = take(mulberry32(7), 20000);
    expect(values.every((v) => v >= 0 && v < 1)).toBe(true);
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    expect(Math.abs(mean - 0.5)).toBeLessThan(0.01);
  });
});

describe("rngFor", () => {
  it("is stable for a key and salt", () => {
    expect(take(rngFor("e2e4 e7e5", 0), 10)).toEqual(take(rngFor("e2e4 e7e5", 0), 10));
  });

  it("differs between keys and between salts", () => {
    const base = take(rngFor("e2e4", 0), 10);
    expect(take(rngFor("d2d4", 0), 10)).not.toEqual(base);
    expect(take(rngFor("e2e4", 1), 10)).not.toEqual(base);
  });
});
