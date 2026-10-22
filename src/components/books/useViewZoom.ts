"use client";

import { useCallback, useMemo, useState } from "react";
import { clampZoom } from "@/lib/books/views/zoom";

/**
 * A book view's zoom, shared by the view (`BookView`) and its controls (`ZoomControls`). The
 * controls ask for a zoom and the view eases its camera there, then sets it; the view also
 * reports the zoom that fits its drawing, which the controls' Fit asks for.
 */
export type ViewZoom = {
  zoom: number;
  /** The zoom at which the whole drawing fits its box. */
  fit: number;
  /** The latest zoom asked for by the controls, numbered so asking twice still counts. */
  asked: { zoom: number; n: number } | null;
  ask: (zoom: number) => void;
  /** For the view: the zoom its camera has reached. */
  set: (zoom: number) => void;
  /** For the view: the zoom that fits its drawing. */
  setFit: (fit: number) => void;
};

export function useViewZoom(): ViewZoom {
  const [zoom, setZoom] = useState(1);
  const [fit, setFit] = useState(1);
  const [asked, setAsked] = useState<ViewZoom["asked"]>(null);
  const ask = useCallback((next: number) => setAsked((old) => ({ zoom: clampZoom(next), n: (old?.n ?? 0) + 1 })), []);
  return useMemo(() => ({ zoom, fit, asked, ask, set: setZoom, setFit }), [zoom, fit, asked, ask]);
}
