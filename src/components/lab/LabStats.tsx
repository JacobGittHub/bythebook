"use client";

import { useEffect, useState, type RefObject } from "react";

/** What a prototype reports about itself. It writes these as it draws; nothing re-renders. */
export type LabStatValues = Record<string, number | string | undefined>;

export type LabStatRow = {
  key: string;
  label: string;
  /** How to show a number. The default is a whole number with thousands separators. */
  format?: (value: number) => string;
};

/** How often the panel reads the shared stats. */
const STATS_REFRESH_MS = 200;

function show(value: number | string | undefined, format?: (value: number) => string) {
  if (value === undefined) return "–";
  if (typeof value === "string") return value;
  return format ? format(value) : Math.round(value).toLocaleString();
}

/**
 * The stats panel in a prototype's sidebar. It owns the refresh timer, so a tick re-renders
 * this panel and nothing else in the harness.
 */
export function LabStats({
  statsRef,
  rows,
}: {
  statsRef: RefObject<LabStatValues>;
  rows: readonly LabStatRow[];
}) {
  const [values, setValues] = useState<LabStatValues>({});

  useEffect(() => {
    const id = setInterval(() => setValues({ ...statsRef.current }), STATS_REFRESH_MS);
    return () => clearInterval(id);
  }, [statsRef]);

  return (
    <>
      {rows.map((row) => (
        <div key={row.key} className="flex justify-between">
          <span className="text-xs text-[var(--bg-sidebar-muted)]">{row.label}</span>
          <span className="font-mono text-xs tabular-nums text-[var(--bg-sidebar-text)]">
            {show(values[row.key], row.format)}
          </span>
        </div>
      ))}
    </>
  );
}
