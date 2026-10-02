"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { NavItem } from "@/lib/auth/access";

/** How long each demo stays up while the window is cycling on its own. */
const DEMO_ROTATE_MS = 7000;
/** The gap between one word of the description appearing and the next. */
const STREAM_WORD_MS = 45;

/** A paragraph that writes itself out a word at a time (see `.stream-word` in globals.css). */
function StreamedText({ text }: { text: string }) {
  return (
    <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">
      {text.split(" ").map((word, index) => (
        <Fragment key={index}>
          <span className="stream-word" style={{ animationDelay: `${index * STREAM_WORD_MS}ms` }}>
            {word}
          </span>{" "}
        </Fragment>
      ))}
    </p>
  );
}

/**
 * The Overview's page tabs and their demo window, as one group. The window cycles through
 * the pages' demos on its own. Pointing at a tab, or focusing it, shows that page's demo and
 * description and holds it there until the pointer leaves; clicking the tab goes to the
 * page. A touch screen has no pointer to hover with, so there the first tap on a tab shows
 * its demo and a second tap, or the window's own button, goes to the page.
 */
export function OverviewShowcase({ items }: { items: NavItem[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  // What the tab looked like when a press began, so a touch can tell a first tap from a second.
  const pressRef = useRef({ touch: false, wasActive: false });

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
      className="grid gap-3 rounded-3xl border border-[var(--border-card)] bg-[var(--bg-muted)] p-3 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-4 lg:p-4"
      onMouseLeave={() => setPaused(false)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);
      }}
    >
      {/* Tabs: a scrolling row of chips on a phone, a column of cards on a wide screen. */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:mx-0 lg:grid lg:content-start lg:overflow-visible lg:p-0">
        {items.map((item, index) => {
          const isActive = index === activeIndex;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={`Jump to ${item.label}`}
              aria-current={isActive ? "true" : undefined}
              className={`group shrink-0 rounded-full border px-3.5 py-1.5 transition-colors lg:rounded-2xl lg:px-4 lg:py-3 ${
                isActive
                  ? "border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-card)] lg:bg-[var(--bg-card)] lg:text-[var(--text-primary)]"
                  : "border-[var(--border-card)] text-[var(--text-primary)] hover:border-[var(--text-primary)]"
              }`}
              onPointerDown={(event) => {
                pressRef.current = { touch: event.pointerType !== "mouse", wasActive: isActive };
              }}
              onMouseEnter={() => show(index)}
              onFocus={() => show(index)}
              onClick={(event) => {
                const press = pressRef.current;
                pressRef.current = { touch: false, wasActive: false };
                if (press.touch && !press.wasActive) event.preventDefault();
              }}
            >
              <span className="flex items-center gap-2">
                <span className="text-sm font-semibold lg:text-base">{item.label}</span>
                {item.status === "coming_soon" ? (
                  <span className="hidden shrink-0 rounded-full border border-[var(--border-card)] px-2 py-0.5 text-xs text-[var(--text-muted)] lg:inline">
                    Coming soon
                  </span>
                ) : null}
                <span className="ml-auto hidden shrink-0 rounded-full border border-[var(--border-card)] px-2.5 py-0.5 text-xs font-medium text-[var(--text-muted)] transition-colors group-hover:border-[var(--text-primary)] group-hover:text-[var(--text-primary)] lg:inline">
                  Jump to page
                </span>
              </span>
              <span className="mt-1 hidden text-sm text-[var(--text-muted)] lg:block">
                {item.summary}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Demo window */}
      <div className="flex min-w-0 flex-col" onMouseEnter={() => setPaused(true)}>
        <div className="flex aspect-video flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border-card)] bg-[var(--bg-card)] text-center">
          <p className="text-lg font-semibold text-[var(--text-primary)]">{active.label}</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">Demo animation coming soon</p>
        </div>
        <div className="mt-3 min-h-[12.5rem] sm:min-h-[8rem]">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-[var(--text-primary)]">{active.label}</h3>
            {active.status === "coming_soon" ? (
              <span className="shrink-0 rounded-full border border-[var(--border-card)] px-2 py-0.5 text-xs text-[var(--text-muted)]">
                Coming soon
              </span>
            ) : null}
          </div>
          <StreamedText key={active.href} text={active.details ?? active.summary} />
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <Link
            href={active.href}
            className="btn-primary rounded-full px-4 py-2 text-sm font-medium"
          >
            Jump to {active.label}
          </Link>
          <p className="text-xs text-[var(--text-muted)]">
            {activeIndex + 1} of {items.length}
          </p>
        </div>
      </div>
    </div>
  );
}
