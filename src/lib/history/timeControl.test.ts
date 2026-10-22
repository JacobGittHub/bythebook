import { describe, expect, it } from "vitest";
import { parseTimeControl, timeClassOf } from "./timeControl";

describe("parseTimeControl", () => {
  it("reads clocks, writing a plain base with its zero increment", () => {
    expect(parseTimeControl("180+2")).toEqual({ kind: "clock", base: 180, increment: 2, text: "180+2" });
    expect(parseTimeControl("300")).toEqual({ kind: "clock", base: 300, increment: 0, text: "300+0" });
    expect(parseTimeControl(" 60+0 ")).toMatchObject({ text: "60+0" });
  });

  it("reads correspondence as seconds a move", () => {
    expect(parseTimeControl("1/86400")).toEqual({ kind: "daily", secondsPerMove: 86400, text: "1/86400" });
    expect(parseTimeControl("1/259200")).toMatchObject({ kind: "daily", secondsPerMove: 259200 });
  });

  it("reads a multi-period control by its first period", () => {
    expect(parseTimeControl("40/5400+30:1800+30")).toEqual({
      kind: "clock",
      base: 5400,
      increment: 30,
      text: "40/5400+30:1800+30",
    });
  });

  it("has no control for unknown, sandglass, empty or malformed headers", () => {
    for (const header of [undefined, "", "-", "?", "*60", "0", "1/0", "abc", "180+", "+2", "9".repeat(41), "1:2:3:x"]) {
      expect(parseTimeControl(header)).toBeNull();
    }
  });
});

describe("timeClassOf", () => {
  const clock = (text: string) => parseTimeControl(text);

  it("files Chess.com games by its rule, which has no classical", () => {
    expect(timeClassOf(clock("60"), "chesscom")).toBe("bullet");
    expect(timeClassOf(clock("120+1"), "chesscom")).toBe("bullet");
    expect(timeClassOf(clock("180"), "chesscom")).toBe("blitz");
    expect(timeClassOf(clock("480"), "chesscom")).toBe("blitz");
    expect(timeClassOf(clock("600"), "chesscom")).toBe("rapid");
    expect(timeClassOf(clock("1800"), "chesscom")).toBe("rapid");
  });

  it("files Lichess and other games by Lichess's rule", () => {
    expect(timeClassOf(clock("15+0"), "lichess")).toBe("bullet");
    expect(timeClassOf(clock("180+0"), "lichess")).toBe("blitz");
    expect(timeClassOf(clock("480"), "lichess")).toBe("rapid");
    expect(timeClassOf(clock("900+10"), "lichess")).toBe("rapid");
    expect(timeClassOf(clock("1800"), "other")).toBe("classical");
    expect(timeClassOf(clock("40/5400+30:1800+30"), "other")).toBe("classical");
  });

  it("files correspondence as daily, and a game without a control by its event", () => {
    expect(timeClassOf(clock("1/86400"), "chesscom")).toBe("daily");
    expect(timeClassOf(null, "lichess", "Casual correspondence game")).toBe("daily");
    expect(timeClassOf(null, "lichess", "Chess party")).toBe("unknown");
  });
});
