// A book's contents (plans/game-history.md D40): each place in its tree where a new opening name
// starts, in the order the views draw them, nested under the opening it grows from. The names
// come from the caller (the catalog, `getOpeningEndingAt`), so this stays pure and tested.

import type { ViewNode, ViewTree } from "./viewTree";

export type ContentsEntry = {
  node: ViewNode;
  /** The opening's full name, such as "Two Knights Defense: Knight Attack". */
  name: string;
  /** The name with its parent entry's name taken off the front: "Knight Attack". */
  short: string;
  /** 0 for a top entry, one more for each entry it lies under. */
  level: number;
  lines: number;
  positions: number;
};

/**
 * `name` with the part it shares with `parent` taken off the front, at a ": " or ", ":
 * "Italian Game: Two Knights Defense, Knight Attack" under "Italian Game: Two Knights Defense" is
 * "Knight Attack".
 */
export function shortName(name: string, parent: string): string {
  let cut = 0;
  for (const match of name.matchAll(/: |, /g)) {
    const head = name.slice(0, match.index);
    if (parent === head || parent.startsWith(`${head}: `) || parent.startsWith(`${head}, `)) cut = match.index + 2;
  }
  return name.slice(cut) || name;
}

/**
 * The entries of `tree`, where `nameAt` names the opening a position starts, or null. On the
 * trunk, the moves before the book first branches, only the last name counts, so a book that
 * starts 1.e4 e5 2.Nf3 Nc6 3.Bc4 opens with "Italian Game", not "King's Pawn Opening".
 */
export function bookContents(tree: ViewTree, nameAt: (node: ViewNode) => string | null): ContentsEntry[] {
  const entries: ContentsEntry[] = [];
  const add = (node: ViewNode, name: string, parent: ContentsEntry | null) => {
    const entry: ContentsEntry = {
      node,
      name,
      short: parent ? shortName(name, parent.name) : name,
      level: parent ? parent.level + 1 : 0,
      lines: node.leaves,
      positions: node.size,
    };
    entries.push(entry);
    return entry;
  };

  // The trunk's last name, which heads the book.
  let trunkEnd = tree.root;
  let head: ContentsEntry | null = null;
  for (let node = tree.root; ; node = node.children[0]) {
    const name = node.depth > 0 ? nameAt(node) : null;
    if (name) head = { node, name, short: name, level: 0, lines: node.leaves, positions: node.size };
    trunkEnd = node;
    if (node.children.length !== 1) break;
  }
  if (head) entries.push(head);

  const walk = (node: ViewNode, parent: ContentsEntry | null) => {
    const name = nameAt(node);
    const under = name && name !== parent?.name ? add(node, name, parent) : parent;
    for (const child of node.children) walk(child, under);
  };
  for (const child of trunkEnd.children) walk(child, head);
  return entries;
}
