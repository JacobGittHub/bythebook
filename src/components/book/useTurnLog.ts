"use client";

import { useEffect, useRef } from "react";
import { useBugReportSection } from "@/context/BugReport";
import type { Motion } from "@/lib/appearance";
import { TURN_LOG_LENGTH, turnLogSection, type TurnRecord } from "@/lib/debug/turnLog";

/**
 * In debug mode, watches each move between pages, a view transition, and adds the last few to
 * the bug report (`turnLogSection`): what the browser ran and whether it finished, for browsers
 * whose console can't be read, such as Safari on a phone.
 */
export function useTurnLog(enabled: boolean, motion: Motion) {
  const records = useRef<TurnRecord[]>([]);

  useEffect(() => {
    const start = document.startViewTransition;
    if (!enabled || !start) return;
    document.startViewTransition = function (...args: Parameters<Document["startViewTransition"]>) {
      const transition = start.apply(document, args);
      const html = document.documentElement;
      const record: TurnRecord = {
        from: location.pathname,
        to: "",
        way: null,
        zoom: null,
        animations: [],
        outcome: "running",
        error: null,
        ms: null,
        frames: 0,
        longestFrameMs: 0,
      };
      records.current = [...records.current, record].slice(-TURN_LOG_LENGTH);

      let readyAt = 0;
      let last = 0;
      let running = true;
      const tick = (time: number) => {
        if (!running) return;
        if (last) {
          record.frames++;
          record.longestFrameMs = Math.max(record.longestFrameMs, time - last);
        }
        last = time;
        requestAnimationFrame(tick);
      };
      const skipped = (error: unknown) => {
        running = false;
        record.outcome = "skipped";
        record.error = error instanceof Error ? error.name : String(error);
      };

      transition.ready.then(() => {
        readyAt = performance.now();
        record.to = location.pathname;
        record.way = html.getAttribute("data-turn");
        record.zoom = html.getAttribute("data-zoom");
        // A frame after the pictures are ready, so the camera's animations have started too.
        requestAnimationFrame((time) => {
          record.animations = document
            .getAnimations()
            .filter((a) => ((a.effect as KeyframeEffect | null)?.pseudoElement ?? "").startsWith("::view-transition"))
            .map((a) => (a instanceof CSSAnimation ? a.animationName : "camera"));
          tick(time);
        });
      }, skipped);
      transition.finished.then(() => {
        running = false;
        record.to ||= location.pathname;
        if (record.outcome === "running") record.outcome = "finished";
        if (readyAt) record.ms = performance.now() - readyAt;
      }, skipped);
      return transition;
    } as Document["startViewTransition"];
    return () => {
      document.startViewTransition = start;
    };
  }, [enabled]);

  useBugReportSection(() => turnLogSection(records.current, "startViewTransition" in document, motion));
}
