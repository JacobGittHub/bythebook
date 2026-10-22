"use client";

import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { MAX_ZOOM, MIN_ZOOM, zoomIn, zoomLabel, zoomOut } from "@/lib/books/views/zoom";
import { cn } from "@/lib/utils";
import type { ViewZoom } from "./useViewZoom";

/**
 * −, the zoom, + and Fit for a book view (plans/deployment.md D21, plans/game-history.md D32).
 * The view also zooms by ctrl+wheel and a two-finger pinch.
 */
export function ZoomControls({ zoom, className }: { zoom: ViewZoom; className?: string }) {
  const fitted = Math.abs(zoom.zoom - zoom.fit) < 0.005;
  return (
    <div role="group" aria-label="Zoom" className={cn("flex items-center gap-0.5", className)}>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label="Zoom out"
        disabled={zoom.zoom <= MIN_ZOOM}
        onClick={() => zoom.ask(zoomOut(zoom.zoom))}
      >
        <Minus />
      </Button>
      <output aria-label="Zoom level" className="w-10 text-center text-xs text-muted-foreground tabular-nums">
        {zoomLabel(zoom.zoom)}
      </output>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label="Zoom in"
        disabled={zoom.zoom >= MAX_ZOOM}
        onClick={() => zoom.ask(zoomIn(zoom.zoom))}
      >
        <Plus />
      </Button>
      <Button variant="ghost" size="xs" disabled={fitted} onClick={() => zoom.ask(zoom.fit)}>
        Fit
      </Button>
    </div>
  );
}
