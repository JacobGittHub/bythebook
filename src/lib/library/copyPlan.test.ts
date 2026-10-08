import { describe, expect, it } from "vitest";
import { START_FEN } from "@/lib/chess/fen";
import { planCopy, resolvePlan, toCandidate, type Candidate } from "./copyPlan";
import { MAX_LIBRARY_BOOKS } from "./types";

const trees = [{ fen: START_FEN, children: [{ uci: "d2d4" }] }];
const raw = (id: string, name: string, extra: object = {}) => ({ id, name, color: "white", trees, ...extra });

describe("toCandidate", () => {
  it("accepts a good book and fills in its origin", () => {
    const candidate = toCandidate(raw("a", "  London "));
    expect(candidate).toMatchObject({ ok: true, book: { id: "a", name: "London", origin: { kind: "own" } } });
  });

  it("gives each rejected book its reason", () => {
    expect(toCandidate(raw("a", ""))).toMatchObject({ ok: false, problem: "invalid" });
    expect(toCandidate(raw("a", "London", { color: "green" }))).toMatchObject({ ok: false, name: "London", problem: "invalid" });
    expect(toCandidate(raw("a", "London", { trees: [{ fen: START_FEN, children: [{ uci: "d2d5" }] }] }))).toMatchObject({
      ok: false,
      problem: "invalid",
      detail: "d2d5 isn't legal after the first position.",
    });
    expect(toCandidate(null)).toMatchObject({ ok: false, name: "A book without a name" });
  });
});

describe("planCopy and resolvePlan", () => {
  const existing = [{ id: "x", name: "London" }];
  const candidates: Candidate[] = [
    toCandidate(raw("a", "london")),
    toCandidate(raw("b", "Caro-Kann")),
    toCandidate(raw("x", "Renamed")),
    toCandidate(raw("c", "Caro-Kann")),
    toCandidate(raw("d", "")),
  ];
  const plan = planCopy(candidates, existing);

  it("sorts each book into new, a name clash, present or rejected", () => {
    expect(plan.map((item) => item.status)).toEqual(["name_clash", "new", "present", "name_clash", "rejected"]);
  });

  it("keeps a clash under a copy's name unless it is skipped", () => {
    const kept = resolvePlan(plan, new Map(), existing);
    expect(kept.write.map(({ index, draft, source }) => [index, draft.name, source.id])).toEqual([
      [0, "london (copy)", "a"],
      [1, "Caro-Kann", "b"],
      [3, "Caro-Kann (copy)", "c"],
    ]);
    const skipped = resolvePlan(plan, new Map([[0, "skip"], [3, "skip"]]), existing);
    expect(skipped.write.map(({ index }) => index)).toEqual([1]);
  });

  it("writes no more than the library has room for", () => {
    const full = Array.from({ length: MAX_LIBRARY_BOOKS - 1 }, (_, i) => ({ id: `e${i}`, name: `Book ${i}` }));
    const result = resolvePlan(planCopy(candidates, full), new Map(), full);
    expect(result.write.map(({ index }) => index)).toEqual([0]);
    expect(result.noRoom).toEqual([1, 2, 3]);
  });
});
