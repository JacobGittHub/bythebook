"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BoardDisplay } from "@/components/board/BoardDisplay";
import { SignInPrompt } from "@/components/ui/SignInPrompt";
import { useViewer } from "@/context/Viewer";
import { creditLine, type ExampleBook } from "@/lib/books/examples";
import {
  averageLeafDepth,
  countPositions,
  findClashes,
  hasUnconnectedLines,
  MAX_BOOK_POSITIONS,
} from "@/lib/books/measures";
import { BOOK_VIEWS, type BookViewId } from "@/lib/books/views";
import {
  buildViewTree,
  heavyLeaf,
  isAncestorOrSelf,
  isClash,
  lineText,
  moveLabel,
  pathTo,
  type ViewNode,
} from "@/lib/books/viewTree";
import { getOpeningForLine } from "@/lib/chess/openingCatalog";
import type { OpeningBook } from "@/types/chess";
import { BookView } from "./BookView";
import { BookViewRail } from "./BookViewRail";
import { useExampleBooks } from "./useExampleBooks";

/** The first book a visitor sees. */
const FIRST_EXAMPLE = "example:queens-gambit";
/** A new book opens this many moves down its main line, so the board starts somewhere. */
const OPENING_DEPTH = 6;

const METHOD_NOTES: Record<ExampleBook["method"], string> = {
  wikibooks: "Made from the page titles of Wikibooks' Chess Opening Theory.",
  catalog: "Made from the opening catalog's named lines (lichess-org/chess-openings, public domain).",
  masters: "Grown from Lichess's master game statistics, as saved by ByTheBook.",
  "catalog+masters": "The opening catalog's named lines, carried on from Lichess's master game statistics.",
};

const formatCount = (n: number) => n.toLocaleString("en-US");

type Props = {
  view: BookViewId;
  /** The viewer's own books; empty for a guest. */
  initialBooks: OpeningBook[];
  /** The book named in the address, if any. */
  initialBookId: string | null;
};

/**
 * A small visualization page: one book drawn by one of the five book views, with a board for
 * the selected or hovered position and what the book's card will say about it.
 */
export function BookViewPage({ view: initialView, initialBooks, initialBookId }: Props) {
  const router = useRouter();
  const { signedIn } = useViewer();
  const [view, setView] = useState<BookViewId>(initialView);
  const [bookId, setBookId] = useState<string>(initialBookId ?? FIRST_EXAMPLE);
  const { entries, books: examples, failed } = useExampleBooks(bookId);

  const book: OpeningBook | ExampleBook | null =
    examples.get(bookId) ?? initialBooks.find((candidate) => candidate.id === bookId) ?? null;
  const tree = useMemo(() => (book ? buildViewTree(book.moveNode) : null), [book]);

  // The selection belongs to the book it was made in; another book starts down its main line.
  const [selection, setSelection] = useState<{ bookId: string; selectedId: string; spineEndId: string } | null>(null);
  const [hovered, setHovered] = useState<ViewNode | null>(null);
  const mainLine = tree ? pathTo(heavyLeaf(tree.root)) : [];
  const current =
    selection && selection.bookId === bookId && tree?.byId.has(selection.selectedId)
      ? selection
      : tree
        ? {
            bookId,
            selectedId: mainLine[Math.min(OPENING_DEPTH, mainLine.length - 1)].id,
            spineEndId: mainLine[mainLine.length - 1].id,
          }
        : null;
  const selected = current && tree ? tree.byId.get(current.selectedId)! : null;
  const shown = hovered ?? selected;

  const syncAddress = (nextView: BookViewId, nextBook: string) => {
    window.history.replaceState(
      null,
      "",
      `/dashboard/visualizations/books/${nextView}?book=${encodeURIComponent(nextBook)}`,
    );
  };

  const select = (node: ViewNode) => {
    if (!tree || !current) return;
    const spineEnd = tree.byId.get(current.spineEndId)!;
    // A position off the spine re-routes it down that position's main line.
    const spineEndId = isAncestorOrSelf(node, spineEnd) ? spineEnd.id : heavyLeaf(node).id;
    setSelection({ bookId, selectedId: node.id, spineEndId });
  };

  const changeView = (next: BookViewId) => {
    setView(next);
    setHovered(null);
    syncAddress(next, bookId);
  };
  const changeBook = (next: string) => {
    setBookId(next);
    setHovered(null);
    syncAddress(view, next);
  };

  const facts = useMemo(() => {
    if (!book) return null;
    const trees = [book.moveNode];
    return {
      positions: countPositions(trees),
      lines: tree?.root.leaves ?? 0,
      depth: averageLeafDepth(trees),
      clashes: findClashes(trees, book.color).length,
      unconnected: hasUnconnectedLines(trees),
    };
  }, [book, tree]);

  const viewInfo = BOOK_VIEWS.find((option) => option.id === view)!;
  const example = examples.get(bookId) ?? null;
  const openingName = shown
    ? getOpeningForLine(
        pathTo(shown)
          .slice(1)
          .map((node) => node.fen),
      )?.name
    : undefined;

  return (
    // Wide: the view beside the panel. Narrow: the panel under the view, so a hover that
    // changes the panel never moves the view.
    <div className="flex h-full min-h-0 flex-col gap-2 lg:flex-row">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
        <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 rounded-2xl border border-[var(--border-card)] bg-[var(--bg-card)] px-3 py-2">
          <div className="min-w-0 flex-1 basis-56">
            <p className="text-[10px] font-medium uppercase tracking-widest text-[var(--text-muted)]">
              Small visualization
            </p>
            <h1 className="truncate text-lg font-semibold leading-tight text-[var(--text-primary)]">{viewInfo.label}</h1>
          </div>
          <label className="flex min-w-0 items-center gap-1.5 text-xs text-[var(--text-muted)]">
            Book
            <select
              aria-label="Book"
              value={bookId}
              onChange={(event) => changeBook(event.target.value)}
              className="min-w-0 max-w-64 rounded-lg border border-[var(--border-card)] bg-[var(--bg-card)] py-1 pl-1.5 pr-5 text-xs text-[var(--text-primary)] focus:outline-none"
            >
              <optgroup label="Examples">
                {(entries ?? []).map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name} ({entry.color})
                  </option>
                ))}
              </optgroup>
              {initialBooks.length > 0 && (
                <optgroup label="Your books">
                  {initialBooks.map((own) => (
                    <option key={own.id} value={own.id}>
                      {own.name} ({own.color})
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </label>
          {!signedIn && <SignInPrompt action="see your own books here" className="text-xs" />}
          <Link href="/dashboard/visualizations" className="btn-ghost shrink-0 rounded-lg px-2 py-1 text-xs">
            All visualizations
          </Link>
        </div>

        <div className="flex min-h-[16rem] flex-1 gap-1.5 rounded-2xl border border-[var(--border-card)] bg-[var(--bg-muted)] p-1.5">
          <BookViewRail view={view} onChange={changeView} />
          {tree && current ? (
            <BookView
              tree={tree}
              view={view}
              selectedId={current.selectedId}
              spineEndId={current.spineEndId}
              side={book?.color ?? null}
              onSelect={select}
              onHover={(node) => setHovered(node)}
              label={`${viewInfo.label} of ${book?.name ?? "the book"}`}
              className="flex-1"
            />
          ) : (
            <p className="m-auto text-sm text-[var(--text-muted)]">
              {failed ? "The example books didn't load." : "Loading the book…"}
            </p>
          )}
        </div>
      </div>

      <aside className="flex max-h-[45%] w-full shrink-0 flex-col gap-2 overflow-y-auto lg:max-h-none lg:w-72">
        <div className="shrink-0 rounded-2xl border border-[var(--border-card)] bg-[var(--bg-card)] p-2.5">
          <p className="truncate text-xs font-medium uppercase tracking-widest text-[var(--text-muted)]">
            {hovered ? "Preview" : "Selected"}
          </p>
          <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
            {shown ? moveLabel(shown) : "…"}
            {openingName && <span className="font-normal text-[var(--text-muted)]"> · {openingName}</span>}
          </p>
          <div className="mx-auto mt-2 w-full max-w-60">
            <BoardDisplay fen={shown?.fen} size="md" orientation={book?.color ?? "white"} animate={!hovered} />
          </div>
          {/* A fixed height, so a long line scrolls instead of moving what is below it. */}
          <p className="mt-2 h-10 overflow-y-auto font-mono text-xs leading-5 text-[var(--text-primary)]">
            {shown ? lineText(pathTo(shown)) || "Starting position" : ""}
          </p>
          {shown && (
            <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
              <dt className="text-[var(--text-muted)]">Positions after</dt>
              <dd className="tabular-nums">{shown.size - (shown.depth > 0 ? 1 : 0)}</dd>
              <dt className="text-[var(--text-muted)]">Lines through</dt>
              <dd className="tabular-nums">{shown.leaves}</dd>
              <dt className="col-span-2 h-4 font-medium text-[var(--view-clash)]">
                {book && isClash(shown, book.color)
                  ? `${book.color === "white" ? "White" : "Black"} has ${shown.children.length} book moves here.`
                  : ""}
              </dt>
            </dl>
          )}
          {selected && (
            <button
              type="button"
              onClick={() => router.push(`/dashboard/explorer?fen=${encodeURIComponent(selected.fen)}`)}
              className="btn-secondary mt-2 w-full rounded-lg px-3 py-1.5 text-xs"
            >
              Open the selected position in the Explorer
            </button>
          )}
        </div>

        {book && facts && (
          <div className="shrink-0 rounded-2xl border border-[var(--border-card)] bg-[var(--bg-card)] p-2.5 text-xs">
            <p className="font-semibold text-[var(--text-primary)]">{book.name}</p>
            {book.description && <p className="mt-0.5 text-[var(--text-muted)]">{book.description}</p>}
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
              <dt className="text-[var(--text-muted)]">Positions</dt>
              <dd className="tabular-nums">
                {formatCount(facts.positions)} / {formatCount(MAX_BOOK_POSITIONS)}
              </dd>
              <dt className="text-[var(--text-muted)]">Lines</dt>
              <dd className="tabular-nums">{facts.lines}</dd>
              <dt className="text-[var(--text-muted)]">Average line</dt>
              <dd className="tabular-nums">{facts.depth === null ? "–" : `${facts.depth.toFixed(1)} plies`}</dd>
              <dt className="text-[var(--text-muted)]">Clashes</dt>
              <dd className="tabular-nums">{facts.clashes}</dd>
              {facts.unconnected && (
                <dd className="col-span-2 font-medium text-[var(--view-clash)]">Unconnected lines</dd>
              )}
            </dl>
            {example && (
              <div className="mt-2 border-t border-[var(--border-card)] pt-2 text-[var(--text-muted)]">
                <p>{METHOD_NOTES[example.method]}</p>
                {example.attribution && (
                  <p className="mt-1">
                    Source:{" "}
                    <a href={example.attribution.url} target="_blank" rel="noreferrer" className="underline">
                      {creditLine(example.attribution)}
                    </a>{" "}
                    (
                    <a href={example.attribution.licenseUrl} target="_blank" rel="noreferrer" className="underline">
                      licence
                    </a>
                    ), retrieved {example.attribution.retrieved}. {example.attribution.changes}
                  </p>
                )}
                {example.method !== "wikibooks" && <p className="mt-1">How it was built: {example.rules}.</p>}
              </div>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
