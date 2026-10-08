"use client";

import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { FIT_ZOOM, MAX_ZOOM, zoomIn, zoomOut } from "@/lib/books/views/zoom";
import { cn } from "@/lib/utils";

/**
 * −, Fit and + for a book view (plans/deployment.md D21). The view also zooms by ctrl+wheel and
 * a two-finger pinch (`BookView`'s `onZoomChange`).
 */
export function ZoomControls({
  zoom,
  onChange,
  className,
}: {
  zoom: number;
  onChange: (zoom: number) => void;
  className?: string;
}) {
  return (
    <div role="group" aria-label="Zoom" className={cn("flex items-center gap-0.5", className)}>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label="Zoom out"
        disabled={zoom <= FIT_ZOOM}
        onClick={() => onChange(zoomOut(zoom))}
      >
        <Minus />
      </Button>
      <Button
        variant="ghost"
        size="xs"
        aria-label="Fit"
        disabled={zoom === FIT_ZOOM}
        onClick={() => onChange(FIT_ZOOM)}
        className="w-11 tabular-nums"
      >
        {zoom === FIT_ZOOM ? "Fit" : `${zoom}×`}
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label="Zoom in"
        disabled={zoom >= MAX_ZOOM}
        onClick={() => onChange(zoomIn(zoom))}
      >
        <Plus />
      </Button>
    </div>
  );
}
