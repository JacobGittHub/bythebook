"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { BookSide } from "@/lib/books/measures";
import { families, heavyLeaf, moveLabel, pathTo, type ViewNode, type ViewTree } from "@/lib/books/viewTree";
import { branchPointsLayout } from "@/lib/books/views/branchPoints";
import {
  CAMERA_EASE_MS,
  cameraAt,
  easeCamera,
  frameCamera,
  highlightIndex,
  scrollFor,
  walkKey,
  type Camera,
  type Walk,
} from "@/lib/books/views/camera";
import type { Box, Point } from "@/lib/books/views/common";
import { icicleLayout } from "@/lib/books/views/icicle";
import type { BookViewId } from "@/lib/books/views";
import { metroLayout } from "@/lib/books/views/metro";
import { plyColumnsLayout } from "@/lib/books/views/plyColumns";
import { spineLayout } from "@/lib/books/views/spine";
import { fitZoom, pinchZoom, wheelZoom } from "@/lib/books/views/zoom";
import { getOpeningForLine } from "@/lib/chess/openingCatalog";
import { BranchPointsView } from "./BranchPointsView";
import { IcicleView } from "./IcicleView";
import { MetroView } from "./MetroView";
import { PlyColumnsView } from "./PlyColumnsView";
import { SpineView } from "./SpineView";
import type { ViewZoom } from "./useViewZoom";
import type { Bind, ViewMarks } from "./viewParts";

/** Room a scrollbar takes, kept free when the other direction overflows. */
const SCROLLBAR = 12;
/** How far the mouse moves before a press becomes a drag. */
const DRAG_START = 4;

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
  /** The view's zoom (`useViewZoom`), shared with its `ZoomControls`. Without it the drawing stays at 100% and only pans. */
  zoom?: ViewZoom;
  /** The user's score from each position, which ply columns paint (plans/game-history.md D35). */
  success?: ReadonlyMap<string, number | null>;
  /** The highlighted move, for a page that shows it elsewhere too; the view keeps its own without. */
  walk?: Walk | null;
  onWalkChange?: (walk: Walk) => void;
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

/** Where a position is drawn, for the camera and the highlight's ring. */
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

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * One book view, sized to its box: picks the layout for `view`, draws it, and reports hovers
 * and clicks. The box never depends on what is drawn, and hovering only changes classes, so
 * nothing moves under the pointer. A drawing bigger than the box scrolls, and can be dragged.
 *
 * The view can be walked with the arrow keys (plans/game-history.md D32): the selected position is
 * the current one, Up and Down move a highlight among its moves, Right goes to the highlighted
 * move and Left back. A camera follows, panning and, given `zoom`, zooming to keep the current
 * position and its moves in frame; its own moves ease, while the wheel and dragging follow the
 * hand at once.
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
  zoom: zoomControl,
  success,
  walk: givenWalk,
  onWalkChange,
  className = "",
}: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [box, setBox] = useState<Box | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [ownWalk, setOwnWalk] = useState<Walk | null>(null);
  const walk = givenWalk === undefined ? ownWalk : givenWalk;
  const setWalk = (next: Walk) => (onWalkChange ? onWalkChange(next) : setOwnWalk(next));

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
  const highlight = highlightIndex(selected, walk);
  const highlighted = highlight >= 0 ? selected.children[highlight] : null;
  const spineEnd = (spineEndId && tree.byId.get(spineEndId)) || heavyLeaf(tree.root);
  const family = useMemo(() => families(tree), [tree]);
  const names = useMemo(() => (view === "metro" ? familyNames(tree) : new Map<string, string>()), [tree, view]);
  const keepKey = view === "branch-points" ? selected.id : "";

  // The icicle is laid out again in a bigger box when zoomed in, so thin blocks grow until their
  // moves fit; the other views keep their layout and are drawn bigger or smaller (`scale`).
  // Either way the drawing scrolls inside the same box, so nothing around the view moves.
  const zoom = zoomControl?.zoom ?? 1;
  const relayout = view === "icicle";
  const scale = relayout ? Math.min(zoom, 1) : zoom;
  const grow = relayout ? Math.max(zoom, 1) : 1;
  const computed = useMemo(() => {
    if (!box || box.width < 40 || box.height < 40) return null;
    const keep = new Set(keepKey ? pathTo(tree.byId.get(keepKey)!).map((node) => node.id) : []);
    const run = (b: Box) => computeLayout(view, tree, b, keep, spineEnd, weight, names);
    const target = { width: box.width * grow, height: box.height * grow };
    // A scrollbar in one direction takes room from the other, so lay out again without it.
    let result = run(target);
    const wide = result.layout.width * scale > box.width + 0.5;
    const tall = result.layout.height * scale > box.height + 0.5;
    if (wide || tall) {
      result = run({
        width: target.width - (tall ? SCROLLBAR / scale : 0),
        height: target.height - (wide ? SCROLLBAR / scale : 0),
      });
    }
    return result;
  }, [box, view, tree, keepKey, spineEnd, weight, names, grow, scale]);

  const fit = computed && box && !relayout ? fitZoom(computed.layout, box) : 1;
  const setFit = zoomControl?.setFit;
  useEffect(() => setFit?.(fit), [setFit, fit]);

  // ── The camera ──
  // While it eases, the drawing's size and scroll are set directly, frame by frame, and the zoom
  // it reaches is handed to `zoomControl` at the end. `shown` is the scale on screen meanwhile.
  const shown = useRef(scale);
  const easing = useRef<number | null>(null);
  const latest = useRef({ computed, zoomControl, relayout, scale });
  useLayoutEffect(() => {
    latest.current = { computed, zoomControl, relayout, scale };
    if (easing.current === null) shown.current = scale;
  });

  /** Moves the camera to `to` over `CAMERA_EASE_MS`, or at once. */
  const moveCamera = useCallback((to: Camera, eased: boolean) => {
    const scroller = scrollRef.current;
    const svg = svgRef.current;
    const { computed: drawn } = latest.current;
    if (!scroller || !svg || !drawn) return;
    if (easing.current !== null) cancelAnimationFrame(easing.current);
    easing.current = null;
    const view = { width: scroller.clientWidth, height: scroller.clientHeight };
    const from = cameraAt({ left: scroller.scrollLeft, top: scroller.scrollTop }, shown.current, view);
    const apply = (camera: Camera) => {
      shown.current = camera.zoom;
      svg.setAttribute("width", String(drawn.layout.width * camera.zoom));
      svg.setAttribute("height", String(drawn.layout.height * camera.zoom));
      const { left, top } = scrollFor(camera, view);
      scroller.scrollLeft = left;
      scroller.scrollTop = top;
    };
    const done = () => {
      easing.current = null;
      const { zoomControl: control, relayout: relaid, scale: current } = latest.current;
      if (control && !relaid && Math.abs(to.zoom - current) > 1e-6) control.set(to.zoom);
    };
    if (!eased || prefersReducedMotion()) {
      apply(to);
      done();
      return;
    }
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / CAMERA_EASE_MS);
      apply(easeCamera(from, to, t));
      if (t < 1) easing.current = requestAnimationFrame(step);
      else done();
    };
    easing.current = requestAnimationFrame(step);
  }, []);
  useEffect(() => () => {
    if (easing.current !== null) cancelAnimationFrame(easing.current);
  }, []);

  // Frame the current position and its moves: eased when the position, the highlight or the
  // asked zoom changes, at once when the drawing itself changes. The camera zooms on its own only
  // when the position changes, so a drawing opens at the zoom it was left at.
  const asked = zoomControl?.asked ?? null;
  const lastFrame = useRef<{ selectedId: string; highlight: number; asked: ViewZoom["asked"]; view: BookViewId; tree: ViewTree; box: Box } | null>(null);
  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    if (!computed || !box || !scroller) return;
    const last = lastFrame.current;
    lastFrame.current = { selectedId: selected.id, highlight, asked, view, tree, box };
    const mayZoom = Boolean(zoomControl) && !relayout;
    let how: { zoom: number | null; auto: boolean; eased: boolean };
    if (asked && asked !== last?.asked) {
      // The icicle is laid out again at the new zoom, and framed when that layout arrives.
      if (relayout) {
        zoomControl?.set(asked.zoom);
        return;
      }
      how = { zoom: asked.zoom, auto: false, eased: true };
    } else if (!last) how = { zoom: null, auto: false, eased: false };
    else if (last.selectedId !== selected.id) how = { zoom: null, auto: mayZoom, eased: true };
    else if (last.highlight !== highlight) how = { zoom: null, auto: false, eased: true };
    else if (last.view !== view || last.tree !== tree || last.box !== box) how = { zoom: null, auto: false, eased: false };
    else return;

    const current = pointOf(computed, selected.id);
    if (!current) return;
    const moves = selected.children.flatMap((child) => pointOf(computed, child.id) ?? []);
    const viewBox = { width: scroller.clientWidth, height: scroller.clientHeight };
    const camera = cameraAt({ left: scroller.scrollLeft, top: scroller.scrollTop }, shown.current, viewBox);
    const target = frameCamera({
      camera: { ...camera, zoom: how.zoom ?? camera.zoom },
      view: viewBox,
      drawing: { width: computed.layout.width, height: computed.layout.height },
      current,
      moves,
      highlight: highlighted ? pointOf(computed, highlighted.id) : null,
      zoom: how.auto,
    });
    moveCamera(target, how.eased);
  }, [computed, box, selected, highlight, highlighted, asked, view, tree, relayout, zoomControl, moveCamera]);

  // ctrl+wheel (a trackpad pinch arrives as one) and a two-finger touch pinch zoom about the
  // pointer, following the hand at once. A mouse drags the drawing to look around. The wheel
  // listener can't be passive, since it stops the page zooming instead.
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    /** Zooms to `next` keeping the drawing's point under `at` (on screen) where it is. */
    const zoomAbout = (next: number, at: { clientX: number; clientY: number }) => {
      const { zoomControl: control, relayout: relaid } = latest.current;
      if (!control) return;
      if (relaid) return control.set(next);
      const rect = scroller.getBoundingClientRect();
      const offset = { x: at.clientX - rect.left, y: at.clientY - rect.top };
      const from = shown.current;
      const point = { x: (scroller.scrollLeft + offset.x) / from, y: (scroller.scrollTop + offset.y) / from };
      const view = { width: scroller.clientWidth, height: scroller.clientHeight };
      moveCamera(
        { zoom: next, x: point.x + (view.width / 2 - offset.x) / next, y: point.y + (view.height / 2 - offset.y) / next },
        false,
      );
    };
    const onWheel = (event: WheelEvent) => {
      const { zoomControl: control, relayout: relaid } = latest.current;
      if (!control || !event.ctrlKey) return;
      event.preventDefault();
      zoomAbout(wheelZoom(relaid ? control.zoom : shown.current, event.deltaY), event);
    };

    const touches = new Map<number, { x: number; y: number }>();
    let pinchFrom = 0;
    const spread = () => {
      const [a, b] = [...touches.values()];
      return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
    };
    let drag: { x: number; y: number; left: number; top: number; moved: boolean } | null = null;
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === "mouse") {
        if (event.button !== 0) return;
        drag = { x: event.clientX, y: event.clientY, left: scroller.scrollLeft, top: scroller.scrollTop, moved: false };
        scroller.focus({ preventScroll: true });
        return;
      }
      if (event.pointerType !== "touch") return;
      touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (touches.size === 2) pinchFrom = spread();
    };
    const onPointerMove = (event: PointerEvent) => {
      if (drag) {
        const dx = event.clientX - drag.x;
        const dy = event.clientY - drag.y;
        if (!drag.moved) {
          if (Math.hypot(dx, dy) < DRAG_START) return;
          drag.moved = true;
          if (easing.current !== null) cancelAnimationFrame(easing.current);
          easing.current = null;
          scroller.setPointerCapture(event.pointerId);
          scroller.dataset.dragging = "";
        }
        scroller.scrollLeft = drag.left - dx;
        scroller.scrollTop = drag.top - dy;
        return;
      }
      if (!touches.has(event.pointerId)) return;
      touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const { zoomControl: control, relayout: relaid } = latest.current;
      if (touches.size !== 2 || !control) return;
      const [a, b] = [...touches.values()];
      const next = pinchZoom(relaid ? control.zoom : shown.current, pinchFrom, spread());
      pinchFrom = spread();
      zoomAbout(next, { clientX: (a.x + b.x) / 2, clientY: (a.y + b.y) / 2 });
    };
    const onPointerEnd = (event: PointerEvent) => {
      if (drag?.moved) {
        // The press ended a drag, so it picks no position.
        scroller.addEventListener("click", (click) => click.stopPropagation(), { capture: true, once: true });
        setTimeout(() => delete scroller.dataset.dragging);
      }
      drag = null;
      touches.delete(event.pointerId);
      pinchFrom = spread();
    };
    scroller.addEventListener("wheel", onWheel, { passive: false });
    scroller.addEventListener("pointerdown", onPointerDown);
    scroller.addEventListener("pointermove", onPointerMove);
    scroller.addEventListener("pointerup", onPointerEnd);
    scroller.addEventListener("pointercancel", onPointerEnd);
    return () => {
      scroller.removeEventListener("wheel", onWheel);
      scroller.removeEventListener("pointerdown", onPointerDown);
      scroller.removeEventListener("pointermove", onPointerMove);
      scroller.removeEventListener("pointerup", onPointerEnd);
      scroller.removeEventListener("pointercancel", onPointerEnd);
    };
  }, [moveCamera]);

  const hovered = hoveredId ? (tree.byId.get(hoveredId) ?? null) : null;
  const marks: ViewMarks = useMemo(
    () => ({
      onPath: new Set(pathTo(selected).map((node) => node.id)),
      onHover: new Set(hovered ? pathTo(hovered).map((node) => node.id) : []),
      selectedId: selected.id,
      next: new Set(selected.children.map((node) => node.id)),
      highlightId: highlighted?.id ?? null,
    }),
    [selected, hovered, highlighted],
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

  const onKeyDown = (event: KeyboardEvent) => {
    const step = walkKey(event.key, selected, walk);
    if (!step) return;
    event.preventDefault();
    setWalk(step.walk);
    if (step.go) onSelect(step.go);
  };

  const common = { tree, marks, bind, side, family, weight: weightOf, success };
  // The highlight's ring, and below 100% the moves' names, keep their size on screen.
  const ringAt = computed && highlighted ? pointOf(computed, highlighted.id) : null;
  const named = computed && scale < 1 ? selected.children.flatMap((node) => {
    const point = pointOf(computed, node.id);
    return point ? [{ node, point }] : [];
  }) : [];

  return (
    <div ref={boxRef} className={`relative min-h-0 min-w-0 ${className}`}>
      <div
        ref={scrollRef}
        tabIndex={0}
        aria-label={`${label}: arrow keys walk the moves`}
        onKeyDown={onKeyDown}
        // With zoom on, two fingers zoom the view instead of the page; one finger still scrolls.
        className={`absolute inset-0 cursor-grab overflow-auto outline-none [scrollbar-width:thin] focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset data-dragging:cursor-grabbing ${zoomControl ? "touch-pan-x touch-pan-y" : ""}`}
      >
        {computed && (
          <svg
            ref={svgRef}
            width={computed.layout.width * scale}
            height={computed.layout.height * scale}
            viewBox={`0 0 ${computed.layout.width} ${computed.layout.height}`}
            className={`bv-svg${scale < 1 ? " is-small" : ""}`}
            role="img"
            aria-label={label}
          >
            {computed.view === "ply-columns" && <PlyColumnsView {...common} layout={computed.layout} />}
            {computed.view === "branch-points" && <BranchPointsView {...common} layout={computed.layout} />}
            {computed.view === "metro" && <MetroView {...common} layout={computed.layout} names={names} />}
            {computed.view === "icicle" && <IcicleView {...common} layout={computed.layout} />}
            {computed.view === "spine" && <SpineView {...common} layout={computed.layout} />}
            {ringAt && <circle cx={ringAt.x} cy={ringAt.y} r={7 / scale} className="bv-ring" pointerEvents="none" vectorEffect="non-scaling-stroke" />}
            {named.map(({ node, point }) => (
              <text
                key={node.id}
                x={point.x + 9 / scale}
                y={point.y + 3.5 / scale}
                className={`bv-label bv-fixed${node === highlighted ? " is-highlighted" : ""}`}
                style={{ fontSize: 9.5 / scale, strokeWidth: 3 / scale }}
              >
                {node.san}
              </text>
            ))}
          </svg>
        )}
      </div>
    </div>
  );
}
