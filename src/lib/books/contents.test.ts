import { describe, expect, it } from "vitest";
import { replaySanLines } from "@/lib/books/examples";
import { START_FEN } from "@/lib/chess/fen";
import { buildMoveTreeFromLines } from "@/lib/chess/moveTree";
import { bookContents, shortName } from "./contents";
import { buildViewTree, pathTo, type ViewNode } from "./viewTree";

const viewOf = (...lines: string[]) => buildViewTree(buildMoveTreeFromLines(replaySanLines(lines).lines, START_FEN));
const sans = (node: ViewNode) => pathTo(node).slice(1).map((step) => step.san).join(" ");

const NAMES: Record<string, string> = {
  e4: "King's Pawn Opening",
  "e4 e5 Nf3 Nc6 Bc4": "Italian Game",
  "e4 e5 Nf3 Nc6 Bc4 Bc5": "Giuoco Piano",
  "e4 e5 Nf3 Nc6 Bc4 Bc5 c3": "Giuoco Piano: Main Line",
  "e4 e5 Nf3 Nc6 Bc4 Bc5 b4": "Evans Gambit",
  "e4 e5 Nf3 Nc6 Bc4 Nf6": "Two Knights Defense",
  "e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5": "Two Knights Defense",
};
const nameAt = (node: ViewNode) => NAMES[sans(node)] ?? null;

describe("bookContents", () => {
  const tree = viewOf("e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6", "e4 e5 Nf3 Nc6 Bc4 Bc5 b4", "e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5");
  const entries = bookContents(tree, nameAt);

  it("starts with the trunk's last name and nests each new name under the one it grows from, in drawn order", () => {
    expect(entries.map((entry) => [entry.level, entry.short])).toEqual([
      [0, "Italian Game"],
      [1, "Giuoco Piano"],
      [2, "Main Line"],
      [2, "Evans Gambit"],
      [1, "Two Knights Defense"],
    ]);
  });

  it("counts each entry's lines and positions from its node", () => {
    const [head, giuoco] = entries;
    expect(head).toMatchObject({ lines: 3, positions: tree.byId.get(head.node.id)!.size });
    expect(giuoco.lines).toBe(2);
  });

  it("shortens a name by what it shares with its parent's, at a colon or a comma", () => {
    expect(shortName("Italian Game: Two Knights Defense, Knight Attack", "Italian Game: Two Knights Defense")).toBe("Knight Attack");
    expect(shortName("Italian Game: Two Knights Defense, Polerio Defense", "Italian Game: Two Knights Defense, Knight Attack")).toBe(
      "Polerio Defense",
    );
    expect(shortName("Italian Game: Two Knights Defense", "Italian Game")).toBe("Two Knights Defense");
    expect(shortName("Ponziani Opening", "Italian Game")).toBe("Ponziani Opening");
  });

  it("keeps the trunk's last name when the trunk's end has none", () => {
    const short = viewOf("e4 e5 Nf3", "e4 c5");
    expect(bookContents(short, nameAt).map((entry) => entry.name)).toEqual(["King's Pawn Opening"]);
  });
});
