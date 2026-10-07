import { describe, expect, it } from "vitest";
import { sameInstant } from "./time";

describe("sameInstant", () => {
  it("matches one instant written either way", () => {
    expect(sameInstant("2026-10-07T12:00:00.123456+00:00", "2026-10-07T12:00:00.123456Z")).toBe(true);
    expect(sameInstant("2026-10-07T12:00:00.123+00:00", "2026-10-07T12:00:00.123Z")).toBe(true);
    expect(sameInstant("2026-10-07T14:00:00.5+02:00", "2026-10-07T12:00:00.500000Z")).toBe(true);
    expect(sameInstant(null, "")).toBe(true);
  });

  it("tells apart times a microsecond apart, and never matches what isn't a time", () => {
    expect(sameInstant("2026-10-07T12:00:00.123456Z", "2026-10-07T12:00:00.123457Z")).toBe(false);
    expect(sameInstant("2026-10-07T12:00:00Z", null)).toBe(false);
    expect(sameInstant("soon", "soon")).toBe(false);
  });
});
