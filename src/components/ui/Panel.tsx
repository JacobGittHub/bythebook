import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * A box inside the page frame: one of the panels that hold a page's content (plans/vibes.md
 * D13). It carries `data-slot="panel"` so a vibe can restyle or decorate every panel at once,
 * and leaves its ::before and ::after to the vibe (globals.css § "Vibe areas"). Padding is
 * the caller's, since panels hold anything from a board to a line of text.
 */
export function Panel({
  as: Element = "div",
  className,
  ...props
}: { as?: "div" | "section" | "article" | "aside" | "header" } & ComponentProps<"div">) {
  return (
    <Element
      data-slot="panel"
      className={cn("relative rounded-md border bg-card text-card-foreground", className)}
      {...props}
    />
  );
}

/** A panel's small heading, such as "Engine" or "Exact line match". It is a paragraph unless
 * it heads a section of the page, where `as` makes it a heading. */
export function PanelLabel({
  as: Element = "p",
  className,
  ...props
}: { as?: "p" | "h2" | "h3" } & ComponentProps<"p">) {
  return (
    <Element
      data-slot="panel-label"
      className={cn(
        "font-heading text-[11px] font-semibold uppercase tracking-wider text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}
