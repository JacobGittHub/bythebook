"use client";

import { Fragment, useEffect, useState } from "react";
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
 * the pages' demos on its own, and waits while the pointer or keyboard focus is inside the
 * group. Pointing at a tab only highlights it. Pressing a tab picks it: the window shows
 * that page's demo and description and stops cycling. Pressing the picked tab again, its
 * "Jump to page" tag at any time, or the window's own button, goes to the page. Mouse,
 * touch and keyboard all work this way.
 */
export function OverviewShowcase({ items }: { items: NavItem[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  // Whether the visitor chose the active tab themselves, as opposed to the cycle landing on it.
  const [picked, setPicked] = useState(false);

  useEffect(() => {
    if (picked || paused || items.length < 2) return;
    // A visitor who asked for less motion gets a window that changes only when they choose.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const id = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % items.length);
    }, DEMO_ROTATE_MS);
    return () => window.clearInterval(id);
  }, [picked, paused, items.length]);

  const active = items[activeIndex];
  if (!active) return null;

  return (
    <div
      className="grid gap-3 rounded-3xl border border-[var(--border-card)] bg-[var(--bg-muted)] p-3 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-4 lg:p-4"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);
      }}
    >
      {/* Tabs: a scrolling row of chips on a phone, a column of cards on a wide screen. */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:mx-0 lg:grid lg:content-start lg:overflow-visible lg:p-0">
        {items.map((item, index) => {
          const isActive = index === activeIndex;
          const isPicked = isActive && picked;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={isPicked ? `Jump to ${item.label}` : `Show ${item.label}`}
              aria-current={isActive ? "true" : undefined}
              className={`group shrink-0 rounded-full border px-3.5 py-1.5 transition-colors lg:rounded-2xl lg:px-4 lg:py-3 ${
                isActive
                  ? "border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-card)] lg:bg-[var(--bg-card)] lg:text-[var(--text-primary)]"
                  : "border-[var(--border-card)] text-[var(--text-primary)] hover:border-[var(--text-primary)]"
              }`}
              onClick={(event) => {
                if (isPicked) return;
                // A press meant for a new tab or window keeps doing that.
                if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
                if ((event.target as Element).closest("[data-jump]")) return;
                event.preventDefault();
                setActiveIndex(index);
                setPicked(true);
              }}
            >
              <span className="flex items-center gap-2">
                <span className="text-sm font-semibold lg:text-base">{item.label}</span>
                {item.status === "coming_soon" ? (
                  <span className="hidden shrink-0 rounded-full border border-[var(--border-card)] px-2 py-0.5 text-xs text-[var(--text-muted)] lg:inline">
                    Coming soon
                  </span>
                ) : null}
                {/* Lit while pressing the tab would route: on its own hover, or once the tab is picked. */}
                <span
                  data-jump
                  className={`ml-auto hidden shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors hover:border-[var(--text-primary)] hover:text-[var(--text-primary)] lg:inline ${
                    isPicked
                      ? "border-[var(--text-primary)] text-[var(--text-primary)]"
                      : "border-[var(--border-card)] text-[var(--text-muted)]"
                  }`}
                >
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
      <div className="flex min-w-0 flex-col">
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
