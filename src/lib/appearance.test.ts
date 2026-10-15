import { describe, expect, it } from "vitest";
import {
  APPEARANCE_SCRIPT,
  LEGACY_MODE_STORAGE_KEY,
  THEME_STORAGE_KEY,
  VIBES_STORAGE_KEY,
  parseMotion,
  parseThemeChoice,
  parseVibes,
  resolveMotion,
  resolveTheme,
} from "./appearance";

describe("parseThemeChoice", () => {
  it("keeps a stored choice", () => {
    expect(parseThemeChoice("dark", null)).toBe("dark");
    expect(parseThemeChoice("light", "dark")).toBe("light");
    expect(parseThemeChoice("system", null)).toBe("system");
  });

  it("follows the system when nothing is stored", () => {
    expect(parseThemeChoice(null, null)).toBe("system");
    expect(parseThemeChoice("purple", null)).toBe("system");
  });

  it("maps an old background mode to light or dark", () => {
    expect(parseThemeChoice(null, "dark")).toBe("dark");
    for (const mode of ["cream", "blue", "green", "red"]) {
      expect(parseThemeChoice(null, mode)).toBe("light");
    }
  });
});

describe("parseVibes", () => {
  it("is on unless turned off", () => {
    expect(parseVibes(null)).toBe(true);
    expect(parseVibes("on")).toBe(true);
    expect(parseVibes("off")).toBe(false);
    expect(parseVibes("maybe")).toBe(true);
  });
});

describe("parseMotion", () => {
  it("keeps a stored motion, and turns pages otherwise", () => {
    expect(parseMotion("slide")).toBe("turn");
    expect(parseMotion("none")).toBe("none");
    expect(parseMotion("turn")).toBe("turn");
    expect(parseMotion(null)).toBe("turn");
    expect(parseMotion("spin")).toBe("turn");
  });
});

describe("resolveMotion", () => {
  it("keeps the choice, unless the system asks for reduced motion", () => {
    expect(resolveMotion("turn", false)).toBe("turn");
    expect(resolveMotion("none", false)).toBe("none");
    expect(resolveMotion("turn", true)).toBe("none");
  });
});

/** Runs the head script against a fake page and returns the attributes it set on <html>. */
function runScript(stored: Record<string, string>, systemDark: boolean) {
  const attributes: Record<string, string> = {};
  const localStorage = { getItem: (key: string) => (key in stored ? stored[key] : null) };
  const document = {
    documentElement: {
      setAttribute: (name: string, value: string) => {
        attributes[name] = value;
      },
    },
  };
  const matchMedia = () => ({ matches: systemDark });
  new Function("localStorage", "document", "matchMedia", APPEARANCE_SCRIPT)(
    localStorage,
    document,
    matchMedia,
  );
  return attributes;
}

describe("APPEARANCE_SCRIPT", () => {
  const cases: [Record<string, string>, boolean][] = [
    [{}, false],
    [{}, true],
    [{ [THEME_STORAGE_KEY]: "dark" }, false],
    [{ [THEME_STORAGE_KEY]: "light" }, true],
    [{ [THEME_STORAGE_KEY]: "system" }, true],
    [{ [THEME_STORAGE_KEY]: "nonsense" }, true],
    [{ [LEGACY_MODE_STORAGE_KEY]: "dark" }, false],
    [{ [LEGACY_MODE_STORAGE_KEY]: "green" }, true],
    [{ [VIBES_STORAGE_KEY]: "off" }, false],
    [{ [VIBES_STORAGE_KEY]: "on", [THEME_STORAGE_KEY]: "dark" }, false],
  ];

  it("sets the same theme and vibes as the store would", () => {
    for (const [stored, systemDark] of cases) {
      const choice = parseThemeChoice(
        stored[THEME_STORAGE_KEY] ?? null,
        stored[LEGACY_MODE_STORAGE_KEY] ?? null,
      );
      expect(runScript(stored, systemDark), JSON.stringify({ stored, systemDark })).toEqual({
        "data-theme": resolveTheme(choice, systemDark),
        "data-vibes": parseVibes(stored[VIBES_STORAGE_KEY] ?? null) ? "on" : "off",
      });
    }
  });
});
