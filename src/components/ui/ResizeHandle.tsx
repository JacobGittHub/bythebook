"use client";

import { useRef, type RefObject } from "react";

/** How far one arrow key press moves the edge. */
const KEY_STEP = 16;

type Props = {
  /** The panel above the handle, whose height it sets. */
  target: RefObject<HTMLElement | null>;
  min: number;
  max: number;
  onResize: (height: number) => void;
  /** A double click puts the panel back to its own size. */
  onReset: () => void;
  label: string;
  className?: string;
};

/**
 * The bottom edge of a panel, dragged up or down to set its height between `min` and `max`.
 * Works with a mouse, a finger or the arrow keys.
 */
export function ResizeHandle({ target, min, max, onResize, onReset, label, className = "" }: Props) {
  const start = useRef<{ y: number; height: number } | null>(null);
  const clamp = (height: number) => Math.round(Math.min(max, Math.max(min, height)));
  const current = () => target.current?.getBoundingClientRect().height ?? min;

  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        start.current = { y: event.clientY, height: current() };
      }}
      onPointerMove={(event) => {
        if (!start.current) return;
        onResize(clamp(start.current.height + event.clientY - start.current.y));
      }}
      onPointerUp={() => {
        start.current = null;
      }}
      onPointerCancel={() => {
        start.current = null;
      }}
      onDoubleClick={onReset}
      onKeyDown={(event) => {
        if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
        event.preventDefault();
        onResize(clamp(current() + (event.key === "ArrowDown" ? KEY_STEP : -KEY_STEP)));
      }}
      title={`${label}. Drag, or use the arrow keys; double-click to reset.`}
      className={`group flex h-2 shrink-0 cursor-row-resize touch-none items-center justify-center outline-none ${className}`}
    >
      <span className="h-0.5 w-10 rounded-full bg-[var(--border-card)] transition-colors group-hover:bg-[var(--text-muted)] group-focus-visible:bg-[var(--text-primary)]" />
    </div>
  );
}
