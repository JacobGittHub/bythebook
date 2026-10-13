"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/shadcn/badge";
import { Button } from "@/components/shadcn/button";
import type { NavItem } from "@/lib/auth/access";
import { cn } from "@/lib/utils";

/** How long each demo stays up while the window is cycling on its own. */
const DEMO_ROTATE_MS = 7000;
/** The gap between one word of the description appearing and the next. */
const STREAM_WORD_MS = 45;

/** A paragraph that writes itself out a word at a time (see `.stream-word` in globals.css). */
function StreamedText({ text }: { text: string }) {
  return (
    <p className="mt-1 text-sm leading-6 text-muted-foreground">
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
      data-slot="panel"
      className="relative grid gap-3 rounded-md border bg-card p-2 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:p-3"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);
      }}
    >
      {/* Tabs: a scrolling row of chips on a phone, a column of cards on a wide screen. */}
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 lg:mx-0 lg:grid lg:content-start lg:overflow-visible lg:p-0">
        {items.map((item, index) => {
          const isActive = index === activeIndex;
          const isPicked = isActive && picked;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={isPicked ? `Jump to ${item.label}` : `Show ${item.label}`}
              aria-current={isActive ? "true" : undefined}
              className={cn(
                "group shrink-0 rounded-md border px-3 py-1.5 transition-colors lg:py-2",
                isActive
                  ? "border-foreground bg-primary text-primary-foreground lg:bg-muted lg:text-foreground"
                  : "hover:border-foreground",
              )}
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
                <span className="font-heading text-sm font-semibold">{item.label}</span>
                {item.status === "coming_soon" ? (
                  <Badge variant="outline" className="hidden font-normal text-muted-foreground lg:inline-flex">
                    Coming soon
                  </Badge>
                ) : null}
                {/* Lit while pressing the tab would route: on its own hover, or once the tab is picked. */}
                <Badge
                  data-jump
                  variant="outline"
                  className={cn(
                    "ml-auto hidden transition-colors hover:border-foreground hover:text-foreground lg:inline-flex",
                    isPicked ? "border-foreground text-foreground" : "text-muted-foreground",
                  )}
                >
                  Jump to page
                </Badge>
              </span>
              <span className="mt-0.5 hidden text-xs text-muted-foreground lg:block">
                {item.summary}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Demo window */}
      <div className="flex min-w-0 flex-col">
        {active.demo ? (
          // A looping GIF, which next/image would only pass through unoptimized.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={active.demo}
            src={active.demo}
            alt={`${active.label} in use`}
            className="aspect-video w-full rounded-md border bg-card object-cover"
          />
        ) : (
          <div className="flex aspect-video flex-col items-center justify-center rounded-md border border-dashed bg-muted text-center">
            <p className="font-heading text-lg font-semibold">{active.label}</p>
            <p className="mt-1 text-xs text-muted-foreground">Demo animation coming soon</p>
          </div>
        )}
        <div className="mt-2 min-h-[12.5rem] sm:min-h-[8rem]">
          <div className="flex items-center gap-2">
            <h3 className="font-heading font-semibold">{active.label}</h3>
            {active.status === "coming_soon" ? (
              <Badge variant="outline" className="font-normal text-muted-foreground">
                Coming soon
              </Badge>
            ) : null}
          </div>
          <StreamedText key={active.href} text={active.details ?? active.summary} />
        </div>
        <div className="mt-2 flex items-center justify-between gap-3">
          <Button asChild size="sm">
            <Link href={active.href}>Jump to {active.label}</Link>
          </Button>
          <p className="text-xs text-muted-foreground">
            {activeIndex + 1} of {items.length}
          </p>
        </div>
      </div>
    </div>
  );
}
