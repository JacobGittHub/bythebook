"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { PageMargin } from "@/components/book/Book";
import { cn } from "@/lib/utils";

/** Rows a scoresheet in the margin always draws, numbered, as a printed one has. */
const SHEET_ROWS = 16;

type Props = {
  /** The line it lists: the picked line, to its end, or the moves played. */
  moves: readonly { san: string }[];
  /** How many of `moves` are on the board. */
  played: number;
  /** Go to the position after `moves[index]`. */
  onPick: (index: number) => void;
  /** The picked line's name, when a line is picked. */
  title?: string | null;
  /** The navigator's buttons. */
  nav: ReactNode;
  /** What the navigator has to say, such as that the board left the picked line. */
  notice?: ReactNode;
  /** In the right page's outer margin (a spread), or as a row under the board (the one-page form). */
  form: "margin" | "row";
};

/**
 * The Explorer's only move list (plans/book-ui.md D6): the line as a scoresheet, white's and
 * black's moves side by side under their move numbers. Moves on the board are in ink, the
 * current one marked; the rest of a picked line is faint, there to go to.
 */
export function Scoresheet({ moves, played, onPick, title, nav, notice, form }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const current = played - 1;

  // Keep the current move in view. Set on the sheet itself: scrollIntoView would scroll the book too.
  useEffect(() => {
    const sheet = sheetRef.current;
    const cell = sheet?.querySelector<HTMLElement>("[data-current]");
    if (!sheet || !cell || form !== "margin") return;
    const top = cell.offsetTop - sheet.offsetTop;
    if (top < sheet.scrollTop || top + cell.offsetHeight > sheet.scrollTop + sheet.clientHeight) {
      sheet.scrollTop = top - sheet.clientHeight / 2;
    }
  }, [current, form]);

  const move = (index: number) => {
    const san = moves[index]?.san;
    if (!san) return <span className="border-b border-rule" />;
    const isCurrent = index === current;
    return (
      <span className={cn("flex items-center", form === "margin" && "border-b border-rule")}>
        <button
          type="button"
          onClick={() => onPick(index)}
          data-current={isCurrent || undefined}
          aria-current={isCurrent ? "step" : undefined}
          className={cn(
            "-ml-1 cursor-pointer rounded-xs px-1 font-mono text-[12.5px] font-medium hover:bg-accent",
            isCurrent && "bg-accent font-bold",
            index >= played && "text-muted-foreground",
          )}
        >
          {san}
        </button>
      </span>
    );
  };

  const empty = moves.length === 0 && <p className="text-sm text-muted-foreground">No moves yet.</p>;

  if (form === "row") {
    return (
      <section aria-label="Line" className="flex flex-col gap-1.5 border-b border-rule pb-2">
        <div className="flex items-start gap-2">
          <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-1.5 gap-y-0.5 self-center">
            {empty}
            {moves.map((_, index) => (
              <span key={index} className="inline-flex items-baseline gap-0.5">
                {index % 2 === 0 && (
                  <span className="font-mono text-[10.5px] text-muted-foreground">{index / 2 + 1}.</span>
                )}
                {move(index)}
              </span>
            ))}
          </div>
          <div className="flex shrink-0 items-center gap-0.5">{nav}</div>
        </div>
        {notice}
      </section>
    );
  }

  const rows = Math.max(SHEET_ROWS, Math.ceil(moves.length / 2));
  return (
    <PageMargin aria-label="Line" className="flex w-[132px] flex-none flex-col gap-2 border-l border-rule pl-3.5">
      <div className="flex items-center gap-2">
        <h2 className="book-sc">Line</h2>
        <span className="grow" />
        <span className="font-mono text-[11px] text-muted-foreground">ply {Math.max(played, 0)}</span>
      </div>
      {title && (
        <p className="-mt-1 truncate text-xs text-muted-foreground" title={title}>
          {title}
        </p>
      )}
      {empty}
      <div
        ref={sheetRef}
        className="grid min-h-0 flex-1 auto-rows-[26px] grid-cols-[22px_1fr_1fr] content-start overflow-y-auto"
      >
        {Array.from({ length: rows }, (_, row) => (
          <span key={row} className="contents">
            <span className="flex items-center border-b border-rule font-mono text-[10.5px] text-muted-foreground">
              {row + 1}.
            </span>
            {move(row * 2)}
            {move(row * 2 + 1)}
          </span>
        ))}
      </div>
      {notice}
      <div className="-mx-1 flex justify-between">{nav}</div>
    </PageMargin>
  );
}
