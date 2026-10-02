"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RouteCard } from "@/components/ui/RouteCard";
import type { NavItem } from "@/lib/auth/access";

/** How long each demo stays up while the window is cycling on its own. */
const DEMO_ROTATE_MS = 6000;

/**
 * The Overview's page buttons beside one demo window. The window cycles through the pages'
 * demos on its own. Pointing at a button, or focusing it, shows that page's demo and
 * description and holds it there until the pointer leaves.
 */
export function OverviewShowcase({ items }: { items: NavItem[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || items.length < 2) return;
    // A visitor who asked for less motion gets a window that changes only when they choose.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const id = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % items.length);
    }, DEMO_ROTATE_MS);
    return () => window.clearInterval(id);
  }, [paused, items.length]);

  const active = items[activeIndex];
  if (!active) return null;

  const show = (index: number) => {
    setActiveIndex(index);
    setPaused(true);
  };

  return (
    <div
      className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]"
      onMouseLeave={() => setPaused(false)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);
      }}
    >
      {/* Page buttons */}
      <div className="grid content-start gap-2">
        {items.map((item, index) => (
          <RouteCard
            key={item.href}
            href={item.href}
            label={item.label}
            summary={item.summary}
            status={item.status}
            active={index === activeIndex}
            onActivate={() => show(index)}
          />
        ))}
      </div>

      {/* Demo window. It sits above the buttons on a narrow screen. */}
      <div
        className="order-first flex flex-col rounded-3xl border border-[var(--border-card)] bg-[var(--bg-muted)] p-4 lg:order-none"
        onMouseEnter={() => setPaused(true)}
      >
        <div className="flex aspect-video flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border-card)] bg-[var(--bg-card)] text-center">
          <p className="text-lg font-semibold text-[var(--text-primary)]">{active.label}</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">Demo animation coming soon</p>
        </div>
        <div className="mt-4 min-h-[8.5rem]">
          <h3 className="font-semibold text-[var(--text-primary)]">{active.label}</h3>
          <p className="mt-1 text-sm text-[var(--text-muted)]">{active.details}</p>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <Link
            href={active.href}
            className="rounded-full bg-[var(--text-primary)] px-4 py-2 text-sm font-medium text-[var(--bg-card)]"
          >
            Open {active.label} →
          </Link>
          <p className="text-xs text-[var(--text-muted)]">
            {activeIndex + 1} of {items.length}
          </p>
        </div>
      </div>
    </div>
  );
}
