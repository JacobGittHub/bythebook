"use client";

import { useState } from "react";
import { heavyLeaf, isAncestorOrSelf, pathTo, type ViewNode, type ViewTree } from "@/lib/books/viewTree";

/** A book opens this many moves down its main line, so the board starts somewhere. */
export const OPENING_DEPTH = 6;

/**
 * The selected and hovered positions in a drawn book. The selection belongs to the book it
 * was made in (`bookKey`), so another book starts down its own main line; a selection whose
 * position has gone (a removed move) falls back the same way.
 */
export function useBookSelection(tree: ViewTree | null, bookKey: string) {
  const [selection, setSelection] = useState<{ bookKey: string; selectedId: string; spineEndId: string } | null>(null);
  const [hovered, setHovered] = useState<ViewNode | null>(null);

  const mainLine = tree ? pathTo(heavyLeaf(tree.root)) : [];
  const current =
    selection && selection.bookKey === bookKey && tree?.byId.has(selection.selectedId) && tree.byId.has(selection.spineEndId)
      ? selection
      : tree
        ? {
            bookKey,
            selectedId: mainLine[Math.min(OPENING_DEPTH, mainLine.length - 1)].id,
            spineEndId: mainLine[mainLine.length - 1].id,
          }
        : null;
  const selected = current && tree ? tree.byId.get(current.selectedId)! : null;
  // A hover from a tree that has since changed shows nothing stale.
  const hover = hovered && tree?.byId.get(hovered.id) === hovered ? hovered : null;

  const select = (node: ViewNode) => {
    if (!tree || !current) return;
    const spineEnd = tree.byId.get(current.spineEndId)!;
    // A position off the spine re-routes it down that position's main line.
    const spineEndId = isAncestorOrSelf(node, spineEnd) ? spineEnd.id : heavyLeaf(node).id;
    setSelection({ bookKey, selectedId: node.id, spineEndId });
  };

  return {
    selectedId: current?.selectedId ?? null,
    spineEndId: current?.spineEndId ?? null,
    selected,
    hovered: hover,
    /** The hovered position, else the selected one: what the board shows. */
    shown: hover ?? selected,
    select,
    setHovered,
  };
}
