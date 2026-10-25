import { describe, expect, it } from "vitest";
import { replaySanLines } from "@/lib/books/examples";
import { buildViewTree } from "@/lib/books/viewTree";
import { START_FEN } from "@/lib/chess/fen";
import { buildMoveTreeFromLines } from "@/lib/chess/moveTree";
import { clashesOf, mostPlayed, openClashes, picksOf, withPicks } from "./drills";

const treeOf = (...lines: string[]) => buildMoveTreeFromLines(replaySanLines(lines).lines, START_FEN);

// White clashes at the start (e4, d4) and after 1.e4 e5 (Nf3, Bc4); Black's choices aren't White's clashes.
const book = treeOf("e4 e5 Nf3 Nc6", "e4 e5 Bc4 Nf6", "e4 c5 Nf3", "d4 d5 c4", "d4 Nf6 c4");
const E4 = "root:e2e4";
const D4 = "root:d2d4";
const E5 = "root:e2e4:e7e5";
const NF3 = `${E5}:g1f3`;
const BC4 = `${E5}:f1c4`;

describe("clashes", () => {
  it("are positions where the book's side has more than one move, open while two or more are ticked", () => {
    const clashes = clashesOf(book, "white", new Map());
    expect(clashes.map((clash) => [clash.node.id, clash.state])).toEqual([
      ["root", "open"],
      [E5, "open"],
    ]);
    expect(clashesOf(book, "black", new Map()).map((clash) => clash.node.id)).toEqual([E4, D4]);
  });

  it("are done with one move ticked, and off below an unticked move", () => {
    const states = (picks: Map<string, Set<string>>) => clashesOf(book, "white", picks).map((clash) => clash.state);
    expect(states(new Map([[E5, new Set([NF3])]]))).toEqual(["open", "done"]);
    expect(states(new Map([["root", new Set([D4])]]))).toEqual(["done", "off"]);
    expect(openClashes(clashesOf(book, "white", new Map([["root", new Set([D4])]])))).toEqual([]);
  });

  it("always keep a move ticked: picks naming none of a clash's moves tick them all", () => {
    const [start] = clashesOf(book, "white", new Map([["root", new Set<string>()], [E5, new Set(["elsewhere"])]]));
    expect([...start.ticked]).toEqual([E4, D4]);
    expect(start.state).toBe("open");
  });
});

describe("picks in a book's trees", () => {
  it("round-trip through the moves' skip flags", () => {
    const picks = new Map([[E5, new Set([BC4])]]);
    const flagged = withPicks(book, "white", picks);
    expect(flagged.children[0].children[0].children.find((child) => child.id === NF3)?.skip).toBe(true);
    expect(picksOf(flagged, "white")).toEqual(picks);
    // The input is left alone.
    expect(picksOf(book, "white").size).toBe(0);
  });

  it("ignore flags off a clash and on every move of one, and writing them clears such flags", () => {
    const stray = withPicks(book, "white", new Map());
    stray.children[0].children[0].skip = true; // 1...e5, Black's move: not White's choice.
    stray.children[1].skip = true;
    stray.children[0].skip = true; // Both of White's first moves.
    expect(picksOf(stray, "white").size).toBe(0);

    const cleaned = withPicks(stray, "white", picksOf(stray, "white"));
    const flags: string[] = [];
    const walk = (node: typeof cleaned) => {
      if (node.skip) flags.push(node.id);
      node.children.forEach(walk);
    };
    walk(cleaned);
    expect(flags).toEqual([]);
  });
});

describe("mostPlayed", () => {
  const view = buildViewTree(book);
  const clash = view.byId.get(E5)!;

  it("keeps the move most of the user's games took", () => {
    expect(mostPlayed(clash, (node) => (node.id === BC4 ? 9 : 3)).id).toBe(BC4);
  });

  it("falls back to the move with the most lines, then the first", () => {
    expect(mostPlayed(view.root).id).toBe(E4);
    expect(mostPlayed(clash).id).toBe(clash.children[0].id);
  });
});
