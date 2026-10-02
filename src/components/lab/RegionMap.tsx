"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { LabSpinner } from "@/components/lab/LabSpinner";
import type { LabStatValues } from "@/components/lab/LabStats";
import { drawScene } from "@/components/lab/regionRender";
import {
  centredCamera,
  panBy,
  reanchor,
  zoomAbout,
  type Camera,
  type Viewport,
} from "@/lib/regions/camera";
import type { Vec } from "@/lib/regions/geometry";
import { FAILED_RETRY_MS, createExplorerLoader, type LoadRequest } from "@/lib/regions/loader";
import { createRegionStore, lineTo, positionBlob } from "@/lib/regions/store";
import { MIN_ROOT_SHARE, buildScene, hitTest, type Scene } from "@/lib/regions/visibility";
import type { ExplorerResponse, Move } from "@/types/chess";

/** A press that travels no farther than this is a click, not a drag. */
const CLICK_THRESHOLD_PX = 4;

/** Time one frame may spend laying out blobs before the rest wait for the next frame. */
const LAYOUT_BUDGET_MS = 6;

/** The root's share of the viewport's smaller side when the map first opens. */
const INITIAL_ROOT_SHARE = 0.9;

/** Zoom per pixel of wheel travel, as an exponent. A pinch on a trackpad reports less travel. */
const WHEEL_ZOOM_RATE = 0.0015;
const TRACKPAD_PINCH_ZOOM_RATE = 0.01;
/** Pixels in one line, for wheels that report lines. */
const WHEEL_LINE_PX = 16;

/** The stretch of time the FPS figure is averaged over. */
const FPS_WINDOW_MS = 500;

type LoadPhase = "loading" | "failed" | "ready";

/** The position the view is inside: the frame blob's, or for an "Other" frame the one it belongs to. */
export type RegionFrame = {
  /** The blob's id, which is its path from the root. */
  id: string;
  fen: string;
  /** The moves that reach the position from the start, in order. */
  moves: Move[];
  /** Whether the position's master games have loaded, are on their way, or didn't load. */
  status: "loading" | "loaded" | "failed";
  /** The position's master games, once loaded. */
  data: ExplorerResponse | null;
};

/**
 * The region map: every move is a pebble inside the pebble of the move before it, sized by
 * master games. Wheel or pinch to zoom, drag to pan, click a dashed "Other" to open it.
 *
 * All of its state lives outside React, in one effect: the canvas redraws in an animation
 * loop when something has changed, and nothing here re-renders while the map is in use.
 */
export default function RegionMap({
  statsRef,
  onFrame,
}: {
  statsRef?: RefObject<LabStatValues>;
  /**
   * Told the frame's position whenever it or its load status changes. Pass a function that
   * stays the same between renders, such as a state setter: a new one rebuilds the map.
   */
  onFrame?: (frame: RegionFrame) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<LoadPhase>("loading");

  useEffect(() => {
    const mounted = canvasRef.current;
    const context = mounted?.getContext("2d");
    if (!mounted || !context) return;
    // Typed without null, for the functions below.
    const canvas: HTMLCanvasElement = mounted;
    const ctx: CanvasRenderingContext2D = context;

    const store = createRegionStore();
    let dirty = true;
    const loader = createExplorerLoader({
      onChange: () => {
        dirty = true;
      },
    });

    let viewport: Viewport = { width: 0, height: 0 };
    let pixelRatio = 1;
    let camera: Camera | null = null;
    let scene: Scene | null = null;
    let shownPhase: LoadPhase = "loading";
    /** The frame position and load status last passed to `onFrame`. */
    let shownFrame: string | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    let frames = 0;
    let fpsSince = performance.now();
    let fps = 0;
    let layoutMs = 0;

    // ── Drawing ──────────────────────────────────────────────────────────────

    function update() {
      if (!camera) return;
      dirty = false;

      const anchor = store.get(camera.anchorId) ?? store.root;
      scene = buildScene(anchor, camera, viewport);
      // Follow the frame, so the camera's numbers stay small at any depth.
      camera = reanchor(camera, anchor, scene.frame);

      // Subdivide the blobs whose positions have loaded, and ask for the rest.
      const started = performance.now();
      const requests: LoadRequest[] = [];
      let laidOut = 0;
      let failed = false;
      for (const { blob, toScreen } of scene.wanted) {
        const state = loader.get(blob.fen);
        if (state?.status !== "loaded") {
          failed ||= state?.status === "failed";
          requests.push({ fen: blob.fen, priority: toScreen.s });
        } else if (laidOut === 0 || performance.now() - started < LAYOUT_BUDGET_MS) {
          store.expand(blob, state.data);
          laidOut++;
        }
      }
      // The panel shows the frame's position, which a wall or an unopened blob hasn't asked for.
      const position = positionBlob(scene.frame);
      const positionState = loader.get(position.fen);
      if (positionState?.status !== "loaded") requests.push({ fen: position.fen, priority: Infinity });

      loader.want(requests);
      if (onFrame) {
        // Read again: `want` may just have started the load.
        const state = loader.get(position.fen);
        const status = state?.status ?? "loading";
        const key = `${position.id}|${status}`;
        if (key !== shownFrame) {
          shownFrame = key;
          onFrame({
            id: position.id,
            fen: position.fen,
            moves: lineTo(position),
            status,
            data: state?.status === "loaded" ? state.data : null,
          });
        }
      }

      // Keep drawing while blobs on show are loading, so the dots on their outlines travel.
      const load = loader.stats();
      if (scene.wanted.length > 0 && load.inFlight + load.queued > 0) dirty = true;

      if (laidOut > 0) {
        layoutMs = performance.now() - started;
        // The new blobs are drawn, and may themselves be subdivided, on the next frame.
        dirty = true;
      }
      if (failed && retryTimer === undefined) {
        retryTimer = setTimeout(() => {
          retryTimer = undefined;
          dirty = true;
        }, FAILED_RETRY_MS);
      }

      ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      drawScene(ctx, scene, viewport, { showLabels: true, now: performance.now() });

      const nextPhase: LoadPhase = store.root.children
        ? "ready"
        : loader.get(store.root.fen)?.status === "failed"
          ? "failed"
          : "loading";
      if (nextPhase !== shownPhase) {
        shownPhase = nextPhase;
        setPhase(nextPhase);
      }
    }

    function writeStats() {
      const stats = statsRef?.current;
      if (!stats) return;
      const load = loader.stats();
      stats.fps = fps;
      stats.blobs = scene?.visible.length ?? 0;
      stats.frameDepth = scene?.frame.depth ?? 0;
      stats.layoutMs = layoutMs;
      stats.pending = load.inFlight + load.queued;
    }

    let raf = requestAnimationFrame(function tick(now) {
      raf = requestAnimationFrame(tick);

      frames++;
      if (now - fpsSince >= FPS_WINDOW_MS) {
        fps = (frames * 1000) / (now - fpsSince);
        frames = 0;
        fpsSince = now;
      }

      if (dirty && viewport.width > 0) update();
      writeStats();
    });

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width === 0 || height === 0) return;

      pixelRatio = window.devicePixelRatio || 1;
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);

      const next = { width, height };
      camera = camera
        ? // Keep what was at the centre of the view at the centre.
          panBy(camera, (width - viewport.width) / 2, (height - viewport.height) / 2)
        : centredCamera(store.root.id, 2 * store.root.reach, next, INITIAL_ROOT_SHARE);
      viewport = next;
      dirty = true;
    });
    observer.observe(canvas);

    // ── Pointer handling ─────────────────────────────────────────────────────
    // Written by hand, not with d3-zoom: d3-zoom keeps a gesture's fixed point in the frame
    // the gesture began in, which would jump when the camera re-anchors mid-gesture.

    const pointers = new Map<number, Vec>();
    /** The one pointer that is down, until it turns into a drag or a second pointer joins. */
    let press: { id: number; x: number; y: number; dragging: boolean } | null = null;
    /** The two pointers' spacing and midpoint when they last moved. */
    let pinch: { span: number; mid: Vec } | null = null;

    function positionOf(event: MouseEvent): Vec {
      const rect = canvas.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    }

    function zoom(point: Vec, factor: number) {
      if (!camera || !scene || factor === 1) return;

      let applied = factor;
      if (factor > 1) {
        if (scene.zoomInBlocked) return;
      } else {
        const smallest =
          (MIN_ROOT_SHARE * Math.min(viewport.width, viewport.height)) / (2 * store.root.reach);
        // The scene is from the last frame, when the camera's scale was the frame's. Allow
        // for the zooming done since.
        const rootScale = scene.rootScale * (camera.k / scene.frameToScreen.s);
        if (rootScale <= smallest) return;
        applied = Math.max(factor, smallest / rootScale);
      }
      camera = zoomAbout(camera, point, applied);
      dirty = true;
    }

    function measurePinch() {
      const [a, b] = [...pointers.values()];
      return {
        span: Math.hypot(a.x - b.x, a.y - b.y),
        mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      };
    }

    function click(point: Vec) {
      if (!scene) return;
      const hit = hitTest(scene, point);
      if (hit?.blob.kind === "other" && hit.blob.status === "closed") {
        store.reveal(hit.blob);
        dirty = true;
      }
    }

    function showCursor(point: Vec | null) {
      if (pointers.size > 0) {
        canvas.style.cursor = "grabbing";
        return;
      }
      const hit = point && scene ? hitTest(scene, point) : null;
      canvas.style.cursor = hit?.blob.status === "closed" ? "pointer" : "grab";
    }

    function onPointerDown(event: PointerEvent) {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      const point = positionOf(event);
      canvas.setPointerCapture(event.pointerId);
      pointers.set(event.pointerId, point);

      press = pointers.size === 1 ? { id: event.pointerId, ...point, dragging: false } : null;
      pinch = pointers.size === 2 ? measurePinch() : null;
    }

    function onPointerMove(event: PointerEvent) {
      const point = positionOf(event);
      const previous = pointers.get(event.pointerId);
      if (!previous) {
        showCursor(point);
        return;
      }
      pointers.set(event.pointerId, point);
      if (!camera) return;

      if (pointers.size === 1) {
        if (press && !press.dragging) {
          if (Math.hypot(point.x - press.x, point.y - press.y) <= CLICK_THRESHOLD_PX) return;
          press.dragging = true;
          showCursor(null);
          // Catch up on the distance the threshold held back.
          camera = panBy(camera, point.x - press.x, point.y - press.y);
        } else {
          camera = panBy(camera, point.x - previous.x, point.y - previous.y);
        }
        dirty = true;
      } else if (pointers.size === 2) {
        const now = measurePinch();
        if (pinch && pinch.span > 0 && now.span > 0) {
          camera = panBy(camera, now.mid.x - pinch.mid.x, now.mid.y - pinch.mid.y);
          dirty = true;
          zoom(now.mid, now.span / pinch.span);
        }
        pinch = now;
      }
    }

    function onPointerUp(event: PointerEvent) {
      if (!pointers.delete(event.pointerId)) return;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);

      const point = positionOf(event);
      if (event.type === "pointerup" && press?.id === event.pointerId && !press.dragging) click(point);
      // A finger left from a pinch carries on as a drag, never as a click.
      press = null;
      pinch = null;
      showCursor(event.pointerType === "mouse" ? point : null);
    }

    function onWheel(event: WheelEvent) {
      event.preventDefault();
      const unit =
        event.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? WHEEL_LINE_PX
          : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? viewport.height
            : 1;
      // Browsers report a trackpad pinch as a wheel event with Ctrl held.
      const rate = event.ctrlKey ? TRACKPAD_PINCH_ZOOM_RATE : WHEEL_ZOOM_RATE;
      zoom(positionOf(event), Math.exp(-event.deltaY * unit * rate));
    }

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    // Not passive, so the page doesn't scroll or zoom under the map.
    canvas.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      if (retryTimer !== undefined) clearTimeout(retryTimer);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("wheel", onWheel);
      loader.dispose();
    };
  }, [statsRef, onFrame]);

  return (
    <div className="relative h-full w-full">
      <canvas ref={canvasRef} className="block h-full w-full cursor-grab touch-none" />
      {phase !== "ready" && (
        <div className="absolute inset-0 bg-[var(--bg-muted)]">
          <LabSpinner
            label={
              phase === "failed"
                ? "The master statistics didn't load. Trying again shortly…"
                : "Laying out the map…"
            }
          />
        </div>
      )}
    </div>
  );
}
