"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { BookSide } from "@/lib/books/measures";
import { families, heavyLeaf, moveLabel, pathTo, type ViewNode, type ViewTree } from "@/lib/books/viewTree";
import { branchPointsLayout } from "@/lib/books/views/branchPoints";
import type { Box, Point } from "@/lib/books/views/common";
import { icicleLayout } from "@/lib/books/views/icicle";
import type { BookViewId } from "@/lib/books/views";
import { metroLayout } from "@/lib/books/views/metro";
import { plyColumnsLayout } from "@/lib/books/views/plyColumns";
import { spineLayout } from "@/lib/books/views/spine";
import { getOpeningForLine } from "@/lib/chess/openingCatalog";
import { BranchPointsView } from "./BranchPointsView";
import { IcicleView } from "./IcicleView";
import { MetroView } from "./MetroView";
import { PlyColumnsView } from "./PlyColumnsView";
import { SpineView } from "./SpineView";
import type { Bind, ViewMarks } from "./viewParts";

/** Room a scrollbar takes, kept free when the other direction overflows. */
const SCROLLBAR = 12;

/** What the drawing is weighted by: the lines in a book, or master games in the Explorer. */
export type ViewWeight = "lines" | "games";

type Props = {
  tree: ViewTree;
  view: BookViewId;
  /** The selected position: highlighted with the line to it, and kept in view. */
  selectedId: string;
  /** The last position of the spine and ribs view's spine. Defaults to the main line. */
  spineEndId?: string;
  /** Whose book it is, for the clash rings; null draws none. */
  side: BookSide | null;
  weight?: ViewWeight;
  onSelect: (node: ViewNode) => void;
  /** The hovered position and the pointer's place on screen, or null when it leaves. */
  onHover?: (node: ViewNode | null, pointer?: Point) => void;
  /** Names the drawing for screen readers. */
  label: string;
  className?: string;
};

/** The family names a metro map writes at its routes' ends, keyed by each route's first station. */
function familyNames(tree: ViewTree): Map<string, string> {
  const names = new Map<string, string>();
  let trunkEnd = tree.root;
  while (trunkEnd.children.length === 1) trunkEnd = trunkEnd.children[0];
  // "Queen's Gambit Declined: Albin Countergambit" is written "Albin Countergambit".
  const nameOf = (node: ViewNode) =>
    getOpeningForLine(
      pathTo(node)
        .slice(1)
        .map((n) => n.fen),
    )
      ?.name.split(": ")
      .pop();
  trunkEnd.children.slice(0, 8).forEach((child, i) => {
    const name = nameOf(child);
    // The heaviest family rides the main line, which starts at the root.
    if (name) names.set(i === 0 ? tree.root.id : child.id, name);
  });
  return names;
}

function computeLayout(
  view: BookViewId,
  tree: ViewTree,
  box: Box,
  keep: ReadonlySet<string>,
  spineEnd: ViewNode,
  weight: ViewWeight,
  names: ReadonlyMap<string, string>,
) {
  switch (view) {
    case "ply-columns":
      return { view, layout: plyColumnsLayout(tree, box) } as const;
    case "branch-points":
      return { view, layout: branchPointsLayout(tree, box, keep) } as const;
    case "metro":
      return { view, layout: metroLayout(tree, box, names) } as const;
    case "icicle":
      return { view, layout: icicleLayout(tree, box, weight) } as const;
    case "spine":
      return { view, layout: spineLayout(tree, box, spineEnd, weight === "games" ? "games" : "positions") } as const;
  }
}
type Computed = ReturnType<typeof computeLayout>;

/** Where a position is drawn, to scroll it into view. */
function pointOf(computed: Computed, id: string): Point | null {
  switch (computed.view) {
    case "ply-columns":
    case "metro":
      return computed.layout.points.get(id) ?? null;
    case "icicle": {
      const cell = computed.layout.cells.get(id);
      return cell ? { x: cell.x + cell.width / 2, y: cell.y + cell.height / 2 } : null;
    }
    case "branch-points": {
      const segment = computed.layout.segments.find((s) => s.run.some((node) => node.id === id));
      return segment ? { x: segment.x, y: segment.y } : null;
    }
    case "spine": {
      const spot = computed.layout.spine.find(({ node }) => node.id === id);
      if (spot) return { x: spot.x, y: computed.layout.midY };
      const rib = computed.layout.ribs.find((r) => r.node.id === id);
      return rib ? { x: rib.x, y: rib.y } : null;
    }
  }
}

/**
 * One book view, sized to its box: picks the layout for `view`, draws it, and reports hovers
 * and clicks. The box never depends on what is drawn, and hovering only changes classes, so
 * nothing moves under the pointer. A drawing bigger than the box scrolls, and the selected
 * position is scrolled into view whenever the selection changes.
 */
export function BookView({
  tree,
  view,
  selectedId,
  spineEndId,
  side,
  weight = "lines",
  onSelect,
  onHover,
  label,
  className = "",
}: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<Box | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  useLayoutEffect(() => {
    const element = boxRef.current;
    if (!element) return;
    const measure = () => {
      const width = Math.floor(element.clientWidth);
      const height = Math.floor(element.clientHeight);
      setBox((old) => (old && old.width === width && old.height === height ? old : { width, height }));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const selected = tree.byId.get(selectedId) ?? tree.root;
  const spineEnd = (spineEndId && tree.byId.get(spineEndId)) || heavyLeaf(tree.root);
  const family = useMemo(() => families(tree), [tree]);
  const names = useMemo(() => (view === "metro" ? familyNames(tree) : new Map<string, string>()), [tree, view]);
  const keepKey = view === "branch-points" ? selected.id : "";

  const computed = useMemo(() => {
    if (!box || box.width < 40 || box.height < 40) return null;
    const keep = new Set(keepKey ? pathTo(tree.byId.get(keepKey)!).map((node) => node.id) : []);
    const run = (b: Box) => computeLayout(view, tree, b, keep, spineEnd, weight, names);
    // A scrollbar in one direction takes room from the other, so lay out again without it.
    let result = run(box);
    const wide = result.layout.width > box.width + 0.5;
    const tall = result.layout.height > box.height + 0.5;
    if (wide || tall) {
      result = run({ width: box.width - (tall ? SCROLLBAR : 0), height: box.height - (wide ? SCROLLBAR : 0) });
    }
    return result;
  }, [box, view, tree, keepKey, spineEnd, weight, names]);

  // Keep the selection in view when it changes, never on hover.
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!computed || !scroller) return;
    const point = pointOf(computed, selectedId);
    if (!point) return;
    const margin = 48;
    const { scrollLeft, scrollTop, clientWidth, clientHeight } = scroller;
    if (point.x < scrollLeft + margin || point.x > scrollLeft + clientWidth - margin) {
      scroller.scrollLeft = point.x - clientWidth / 2;
    }
    if (point.y < scrollTop + margin || point.y > scrollTop + clientHeight - margin) {
      scroller.scrollTop = point.y - clientHeight / 2;
    }
  }, [computed, selectedId]);

  const hovered = hoveredId ? (tree.byId.get(hoveredId) ?? null) : null;
  const marks: ViewMarks = useMemo(
    () => ({
      onPath: new Set(pathTo(selected).map((node) => node.id)),
      onHover: new Set(hovered ? pathTo(hovered).map((node) => node.id) : []),
      selectedId: selected.id,
    }),
    [selected, hovered],
  );

  const maxGames = useMemo(() => Math.max(1, ...tree.nodes.map((node) => node.games ?? 0)), [tree]);
  const weightOf = (node: ViewNode) =>
    weight === "games" && node.games !== null
      ? Math.sqrt(node.games / maxGames)
      : Math.sqrt(node.size / Math.max(tree.root.size, 1));

  const bind: Bind = (node, extra = "") => ({
    className: `bv-hit${extra ? ` ${extra}` : ""}`,
    "data-move": moveLabel(node),
    onMouseEnter: (event) => {
      setHoveredId(node.id);
      onHover?.(node, { x: event.clientX, y: event.clientY });
    },
    onMouseMove: (event) => onHover?.(node, { x: event.clientX, y: event.clientY }),
    onMouseLeave: () => {
      setHoveredId(null);
      onHover?.(null);
    },
    onClick: () => onSelect(node),
  });

  const common = { tree, marks, bind, side, family, weight: weightOf };

  return (
    <div ref={boxRef} className={`relative min-h-0 min-w-0 ${className}`}>
      <div ref={scrollRef} className="absolute inset-0 overflow-auto [scrollbar-width:thin]">
        {computed && (
          <svg
            width={computed.layout.width}
            height={computed.layout.height}
            className="bv-svg"
            role="img"
            aria-label={label}
          >
            {computed.view === "ply-columns" && <PlyColumnsView {...common} layout={computed.layout} />}
            {computed.view === "branch-points" && <BranchPointsView {...common} layout={computed.layout} />}
            {computed.view === "metro" && <MetroView {...common} layout={computed.layout} names={names} />}
            {computed.view === "icicle" && <IcicleView {...common} layout={computed.layout} />}
            {computed.view === "spine" && <SpineView {...common} layout={computed.layout} />}
          </svg>
        )}
      </div>
    </div>
  );
}
