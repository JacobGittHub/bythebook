import { describe, expect, it } from "vitest";
import { explorerBodySchema, explorerQuerySchema } from "@/lib/validators/schemas";
import { START_FEN, fenAfterUci, isValidFen } from "./fen";
import { listCatalogFens } from "./openingCatalog";

describe("isValidFen", () => {
  it("accepts every catalog position", () => {
    expect(listCatalogFens().filter((fen) => !isValidFen(fen))).toEqual([]);
  });

  it("rejects text that is not a FEN, and a FEN missing fields", () => {
    expect(isValidFen("not a fen")).toBe(false);
    expect(isValidFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -")).toBe(false);
    expect(isValidFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBN w KQkq - 0 1")).toBe(false);
  });
});

describe("explorer request schemas", () => {
  it("refuse a malformed FEN", () => {
    expect(explorerBodySchema.safeParse({ fen: "not a fen" }).success).toBe(false);
    expect(explorerQuerySchema.safeParse({ fen: "not a fen" }).success).toBe(false);
  });

  it("accept a FEN, and read a missing or empty one as the start position", () => {
    const e4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";
    expect(explorerBodySchema.parse({ fen: ` ${e4} ` }).fen).toBe(e4);
    expect(explorerQuerySchema.parse({}).fen).toBe(START_FEN);
    expect(explorerQuerySchema.parse({ fen: "startpos" }).fen).toBe(START_FEN);
  });
});

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
