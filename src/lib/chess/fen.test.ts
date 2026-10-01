import { describe, expect, it } from "vitest";
import { START_FEN, fenAfterUci } from "./fen";

describe("fenAfterUci", () => {
  it("plays a move from the start", () => {
    expect(fenAfterUci(START_FEN, "e2e4")).toBe(
      "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
    );
  });

  it("castles with king-to-destination UCI", () => {
    const italian = "r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4";
    expect(fenAfterUci(italian, "e1g1")).toBe(
      "r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQ1RK1 b kq - 5 4",
    );
  });

  it("promotes", () => {
    expect(fenAfterUci("8/P7/8/8/8/8/8/k6K w - - 0 1", "a7a8q")).toBe("Q7/8/8/8/8/8/8/k6K b - - 0 1");
  });

  it("returns null for an illegal move or a bad FEN", () => {
    expect(fenAfterUci(START_FEN, "e2e5")).toBeNull();
    expect(fenAfterUci("not a fen", "e2e4")).toBeNull();
  });
});
