"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLibraryBook, useLibraryBooks } from "@/context/Library";
import { EXAMPLE_ID_PREFIX, EXAMPLE_METHOD_NOTES, creditLine, type ExampleBook } from "@/lib/books/examples";
import { MAX_BOOK_POSITIONS } from "@/lib/books/measures";
import { BOOK_VIEWS, type BookViewId } from "@/lib/books/views";
import { FIT_ZOOM } from "@/lib/books/views/zoom";
import { buildViewTree, pathTo } from "@/lib/books/viewTree";
import { explorerHref } from "@/lib/library/links";
import { startTree } from "@/lib/library/trees";
import type { LibraryBook } from "@/lib/library/types";
import { BookView } from "./BookView";
import { BookViewRail } from "./BookViewRail";
import { SelectedPosition } from "./SelectedPosition";
import { useBookSelection } from "./useBookSelection";
import { useExampleBooks } from "./useExampleBooks";
import { ZoomControls } from "./ZoomControls";

/** The first book a visitor sees. */
const FIRST_EXAMPLE = "example:queens-gambit";


const formatCount = (n: number) => n.toLocaleString("en-US");

type Props = {
  view: BookViewId;
  /** The book named in the address, if any. */
  initialBookId: string | null;
};

/**
 * A small visualization page: one book drawn by one of the five book views, with a board for
 * the selected or hovered position and what the book's card will say about it.
 */
export function BookViewPage({ view: initialView, initialBookId }: Props) {
  const router = useRouter();
  const [view, setView] = useState<BookViewId>(initialView);
  const [bookId, setBookId] = useState<string>(initialBookId ?? FIRST_EXAMPLE);
  const { entries, books: examples, failed } = useExampleBooks(bookId);
  // The viewer's own books, a guest's included, from the library.
  const { books: ownBooks } = useLibraryBooks();
  const isExample = bookId.startsWith(EXAMPLE_ID_PREFIX);
  const { book: ownBook, status: ownStatus } = useLibraryBook(isExample ? null : bookId);

  const book: LibraryBook | ExampleBook | null = isExample ? (examples.get(bookId) ?? null) : ownBook;
  const tree = useMemo(() => (book ? buildViewTree(startTree(book.trees)) : null), [book]);

  const { selectedId, spineEndId, selected, hovered, shown, select, setHovered } = useBookSelection(tree, bookId);
  const [zoom, setZoom] = useState<number>(FIT_ZOOM);

  const syncAddress = (nextView: BookViewId, nextBook: string) => {
    window.history.replaceState(
      null,
      "",
      `/dashboard/visualizations/books/${nextView}?book=${encodeURIComponent(nextBook)}`,
    );
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

  const facts = book?.summary ?? null;

  const viewInfo = BOOK_VIEWS.find((option) => option.id === view)!;
  const example = examples.get(bookId) ?? null;

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
              {ownBooks && ownBooks.length > 0 && (
                <optgroup label="Your books">
                  {ownBooks.map((own) => (
                    <option key={own.id} value={own.id}>
                      {own.name} ({own.color})
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </label>
          <Link href="/dashboard/visualizations" className="btn-ghost shrink-0 rounded-lg px-2 py-1 text-xs">
            All visualizations
          </Link>
        </div>

        <div className="flex min-h-[16rem] flex-1 gap-1.5 rounded-2xl border border-[var(--border-card)] bg-[var(--bg-muted)] p-1.5">
          <BookViewRail view={view} onChange={changeView} />
          {tree && selectedId && spineEndId ? (
            <div className="relative flex min-h-0 min-w-0 flex-1">
              <BookView
                tree={tree}
                view={view}
                selectedId={selectedId}
                spineEndId={spineEndId}
                side={book?.color ?? null}
                onSelect={select}
                onHover={(node) => setHovered(node)}
                label={`${viewInfo.label} of ${book?.name ?? "the book"}`}
                zoom={zoom}
                onZoomChange={setZoom}
                className="flex-1"
              />
              <ZoomControls
                zoom={zoom}
                onChange={setZoom}
                className="absolute right-3.5 bottom-3.5 rounded-md border bg-card/90"
              />
            </div>
          ) : (
            <p className="m-auto text-sm text-[var(--text-muted)]">
              {isExample
                ? failed
                  ? "The example books didn't load."
                  : "Loading the book…"
                : ownStatus === "missing"
                  ? "This book isn't in your library."
                  : ownStatus === "failed"
                    ? "The book couldn't be opened."
                    : "Loading the book…"}
            </p>
          )}
        </div>
      </div>

      <aside className="flex max-h-[45%] w-full shrink-0 flex-col gap-2 overflow-y-auto lg:max-h-none lg:w-72">
        <SelectedPosition
          node={shown}
          preview={hovered !== null}
          side={book?.color ?? "white"}
          boardClassName="max-w-60"
          className="shrink-0 rounded-2xl border border-[var(--border-card)] bg-[var(--bg-card)] p-2.5"
        >
          {selected && (
            <button
              type="button"
              onClick={() =>
                router.push(explorerHref({ bookId: isExample ? null : bookId, line: pathTo(selected) }))
              }
              className="btn-secondary w-full rounded-lg px-3 py-1.5 text-xs"
            >
              Open the selected position in the Explorer
            </button>
          )}
        </SelectedPosition>

        {book && facts && (
          <div className="shrink-0 rounded-2xl border border-[var(--border-card)] bg-[var(--bg-card)] p-2.5 text-xs">
            <p className="font-semibold text-[var(--text-primary)]">{book.name}</p>
            {example && <p className="mt-0.5 text-[var(--text-muted)]">{example.description}</p>}
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
              <dt className="text-[var(--text-muted)]">Positions</dt>
              <dd className="tabular-nums">
                {formatCount(facts.positions)} / {formatCount(MAX_BOOK_POSITIONS)}
              </dd>
              <dt className="text-[var(--text-muted)]">Lines</dt>
              <dd className="tabular-nums">{facts.lines}</dd>
              <dt className="text-[var(--text-muted)]">Average line</dt>
              <dd className="tabular-nums">{facts.averageDepth === null ? "–" : `${facts.averageDepth.toFixed(1)} plies`}</dd>
              <dt className="text-[var(--text-muted)]">Clashes</dt>
              <dd className="tabular-nums">{facts.clashes}</dd>
              {facts.unconnected && (
                <dd className="col-span-2 font-medium text-[var(--view-clash)]">Unconnected lines</dd>
              )}
            </dl>
            {example && (
              <div className="mt-2 border-t border-[var(--border-card)] pt-2 text-[var(--text-muted)]">
                <p>{EXAMPLE_METHOD_NOTES[example.method]}</p>
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
