import type { ComponentProps, CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

// The book's parts (plans/book-ui.md D1, D3, D4, D15). Each vibe area carries a `data-slot`
// and leaves its ::before and ::after to vibes (globals.css § "Vibe areas"); the paint is in
// globals.css § "The book". Where a part sits comes from the caller for now, and from the
// book's layout function once it exists (book-ui.md Phase 2).

export type BookForm = "spread" | "single";
export type PageSide = "left" | "right" | "single";

/**
 * The book: its cover, the stacks of page edges on either side and, as children, its pages.
 * `edges` gives the stacks' thickness in pixels, which says how far into the book the current
 * page is. A vibe sets its tokens on this element.
 */
export function Book({
  form,
  edges,
  className,
  style,
  children,
  ...props
}: {
  form: BookForm;
  edges: { left: number; right: number };
} & ComponentProps<"div">) {
  const vars = { "--edge-left": `${edges.left}px`, "--edge-right": `${edges.right}px` } as CSSProperties;
  return (
    <div
      data-slot="book"
      data-form={form}
      className={cn("book", className)}
      style={{ ...vars, ...style }}
      {...props}
    >
      <span data-slot="cover" aria-hidden />
      <span data-slot="page-edge" data-side="left" aria-hidden />
      {children}
      {form === "single" && <span className="book-facing" aria-hidden />}
      <span data-slot="page-edge" data-side="right" aria-hidden />
    </div>
  );
}

/**
 * One page: its running head, its body and its folio, the gutter's shadow on its spine side,
 * and `marks`, the bookmark or page tab that belongs to it and so turns with it. The page
 * itself never clips, so a mark may reach past its edge; its content clips inside.
 */
export function BookPage({
  side,
  head,
  folio,
  marks,
  className,
  children,
  ...props
}: {
  side: PageSide;
  head?: ReactNode;
  folio?: ReactNode;
  marks?: ReactNode;
} & ComponentProps<"section">) {
  return (
    <section data-slot="page" data-side={side} className={cn("book-page", className)} {...props}>
      <div className="book-page-inner">
        <header data-slot="running-head" className="book-running-head">
          {head}
        </header>
        <div className="book-page-body">{children}</div>
        <footer data-slot="folio" className="book-folio">
          {folio}
        </footer>
      </div>
      <span data-slot="gutter" aria-hidden />
      {marks}
    </section>
  );
}

/** A page's outer margin, for what sits beside the text, such as the Explorer's scoresheet. */
export function PageMargin({ className, ...props }: ComponentProps<"aside">) {
  return <aside data-slot="margin" className={cn("relative", className)} {...props} />;
}

/**
 * A page's bookmark (D4): a ribbon folded over the page's top edge, `x` pixels from the page's
 * left edge, under the page's tab in the strip.
 */
export function Bookmark({ x }: { x: number }) {
  return <span className="book-bookmark" style={{ left: x }} aria-hidden />;
}

/**
 * A page's tab in the one-page form (D15): a short ribbon around the page's fore-edge, `top`
 * pixels down the page and `height` tall, level with its chapter in the column beside it.
 */
export function PageTab({ top, height }: { top: number; height: number }) {
  return <span className="book-page-tab" style={{ top, height }} aria-hidden />;
}
