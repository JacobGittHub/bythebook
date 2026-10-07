import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
import type { ExplorerMove } from "@/types/chess";
import { EXPLORER_ALTERNATES, explorerTree } from "./explorerTree";
import { buildViewTree, heavyLeaf, pathTo } from "./viewTree";

const stat = (san: string, uci: string, games: number): ExplorerMove => ({ san, uci, white: games, draws: 0, black: 0 });

function played(sans: string[]) {
  const game = new Chess();
  return sans.map((san) => {
    const move = game.move(san);
    return { san: move.san, uci: move.lan, fen: game.fen() };
  });
}

describe("explorerTree", () => {
  const history = played(["e4", "c5"]);
  const start = [stat("d4", "d2d4", 500), stat("e4", "e2e4", 400), stat("Nf3", "g1f3", 100)];
  const afterE4 = [stat("e5", "e7e5", 300), stat("c5", "c7c5", 280), stat("e6", "e7e6", 0)];
  const next = [stat("Nf3", "g1f3", 200), stat("Nc3", "b1c3", 50)];

  it("draws the played line first, the unplayed master moves beside it and the next moves after it", () => {
    const { source, currentId } = explorerTree({ history, before: [start, afterE4], next });
    const tree = buildViewTree(source);
    // e4 is pinned ahead of the more popular d4.
    expect(tree.root.children.map((node) => node.san)).toEqual(["e4", "d4", "Nf3"]);
    const e4 = tree.root.children[0];
    // A move no master played isn't drawn.
    expect(e4.children.map((node) => node.san)).toEqual(["c5", "e5"]);
    const current = tree.byId.get(currentId)!;
    expect(pathTo(current).map((node) => node.san)).toEqual([null, "e4", "c5"]);
    expect(current.children.map((node) => [node.san, node.games])).toEqual([["Nf3", 200], ["Nc3", 50]]);
    // The spine and ribs view's main line runs through the played moves to the top next move.
    expect(heavyLeaf(tree.root).san).toBe("Nf3");
    expect(heavyLeaf(tree.root).parent).toBe(current);
  });

  it("caps the unplayed moves and works before any numbers arrive", () => {
    const many = Array.from({ length: 10 }, (_, i) => stat(`m${i}`, ["a2a3", "b2b3", "c2c3", "d2d3", "f2f3", "g2g3", "h2h3", "a2a4", "b2b4", "c2c4"][i], 10 + i));
    const tree = buildViewTree(explorerTree({ history: played(["e4"]), before: [many], next: [] }).source);
    expect(tree.root.children).toHaveLength(1 + EXPLORER_ALTERNATES);
    const bare = buildViewTree(explorerTree({ history, before: [null, null], next: [] }).source);
    expect(bare.nodes.map((node) => node.san)).toEqual([null, "e4", "c5"]);
  });
});
