"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { PageEar } from "@/components/book/PageEar";
import { Spread } from "@/components/book/Spread";
import { useBookSelection } from "@/components/books/useBookSelection";
import { Button } from "@/components/shadcn/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/shadcn/popover";
import { Skeleton } from "@/components/shadcn/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/shadcn/toggle-group";
import { useLibrary, useLibraryBooks } from "@/context/Library";
import { bookContents, shortName, type ContentsEntry } from "@/lib/books/contents";
import { EXAMPLE_METHOD_NOTES, exampleDraft, type ExampleBook } from "@/lib/books/examples";
import { countOwnMoves, measuredDifficulty } from "@/lib/books/measures";
import type { BookViewId } from "@/lib/books/views";
import { highlightIndex, type Walk } from "@/lib/books/views/camera";
import { buildViewTree, pathTo, type ViewNode, type ViewTree } from "@/lib/books/viewTree";
import { getOpeningEndingAt } from "@/lib/chess/openingCatalog";
import { bookstoreHref, libraryBookHref } from "@/lib/library/links";
import { fitBookName } from "@/lib/library/names";
import type { ShelfFilters } from "@/lib/library/search";
import { startTree } from "@/lib/library/trees";
import { libraryErrorMessage } from "@/lib/library/types";
import { BookDrawing, BookPageHead } from "./BookDrawing";
import { BookFacts } from "./BookFacts";
import { JumpTag, PublisherLabel, SideTag, countOf, originFolio, originShort, positionsOfLimit, storeVerified } from "./BookParts";
import { BookPosition } from "./BookPosition";
import { DEFAULT_READER_VIEW } from "./BookReader";
import { shelfBooks } from "./BookstorePage";
import { useStoreBooks } from "./useStoreBooks";

const STORE_NOTES = {
  browser: "Saving copies it into this browser's library.",
  account: "Saving copies it into your account's library.",
} as const;

const nameAt = (node: ViewNode) => getOpeningEndingAt(node.fen)?.name ?? null;

/**
 * A store book's page, the Bookstore's second level, on a whole spread (plans/bookstore.md D24,
 * `plans/mockups/bookstore-spread.html` layout B; D8, D14, D20). The left page is the book's
 * title, publisher and description with Save to library, which copies it into the browser for a
 * guest and into the account when signed in; its facts; "In this book", the openings it names;
 * and one section that switches between its reviews and its leaderboard, which say so until they
 * have rows. Reviews are written from a saved copy in the Library, not here (D22, as amended).
 * The right page is the current position and the book in a view, walked with the arrow keys from
 * anywhere on the page. The way back to the shelf, searched and filtered as it was, is the left
 * page's ear (plans/book-ui.md D21, D22).
 */
export function StoreBookPage({ storeId, shelf }: { storeId: string; shelf: ShelfFilters }) {
  const { books, failed } = useStoreBooks();
  const book = books?.find((candidate) => candidate.id === storeId) ?? null;
  const shelved = books ? shelfBooks(books, shelf) : null;
  const index = shelved?.findIndex((candidate) => candidate.id === storeId) ?? -1;
  const model = useStoreModel(book);

  let left;
  let right;
  if (books === null && !failed) {
    left = <Skeleton className="h-64 w-full" />;
    right = <Skeleton className="min-h-64 w-full flex-1" />;
  } else if (!book || !model) {
    left = (
      <p className="py-6 text-sm text-muted-foreground">
        {failed ? "The Bookstore's books didn't load." : "The Bookstore has no such book."}
      </p>
    );
    right = null;
  } else {
    left = <LeftPage book={book} model={model} />;
    right = <RightPage book={book} model={model} />;
  }

  return (
    <Spread
      left={{
        ear: <PageEar side="left" word="Shelf" label="Back to the shelf" href={bookstoreHref(shelf)} />,
        head: (
          <>
            <span className="grow" />
            <span className="book-sc">Bookstore{shelved ? ` · ${countOf(shelved.length, "book")}` : ""}</span>
          </>
        ),
        body: left,
        folio: shelved && index >= 0 && (
          <>
            <span className="grow" />
            <span>
              Book {index + 1} of {shelved.length}
            </span>
          </>
        ),
      }}
      right={{
        head: book && <BookPageHead name={fitBookName(book.name)} side={book.color} whose={originShort(book.origin)} />,
        body: right,
        folio: book && (
          <>
            <span>{originFolio(book.origin)}</span>
            <span className="grow" />
            <span>{positionsOfLimit(book.summary)}</span>
          </>
        ),
      }}
    />
  );
}

/** What the two pages share. */
type StoreModel = {
  tree: ViewTree;
  selected: ViewNode;
  spineEndId: string | undefined;
  select: (node: ViewNode) => void;
  hoveredId: string | null;
  setHoveredId: (id: string | null) => void;
  walk: Walk | null;
  setWalk: (walk: Walk) => void;
  view: BookViewId;
  setView: (view: BookViewId) => void;
};

function useStoreModel(book: ExampleBook | null): StoreModel | null {
  const [walk, setWalk] = useState<Walk | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [view, setView] = useState<BookViewId>(DEFAULT_READER_VIEW.large);
  const tree = useMemo(() => (book ? buildViewTree(startTree(book.trees)) : null), [book]);
  // The page opens down the book's main line, as the reader does (`useBookSelection`).
  const selection = useBookSelection(tree, book?.id ?? "");
  if (!book || !tree) return null;
  return {
    tree,
    selected: selection.selected ?? tree.root,
    spineEndId: selection.spineEndId ?? undefined,
    select: (node) => {
      selection.select(node);
      setHoveredId(null);
    },
    hoveredId,
    setHoveredId,
    walk,
    setWalk,
    view,
    setView,
  };
}

function LeftPage({ book, model }: { book: ExampleBook; model: StoreModel }) {
  const { tree, selected, select } = model;
  const difficulty = useMemo(() => measuredDifficulty(book.trees, book.color), [book]);
  const ownMoves = useMemo(() => countOwnMoves(book.trees, book.color), [book]);
  const contents = useMemo(() => bookContents(tree, nameAt), [tree]);
  const onPath = new Set(pathTo(selected).map((node) => node.id));

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <header className="flex shrink-0 flex-col gap-2">
        <h1 className="flex flex-wrap items-baseline gap-x-3 font-heading text-[32px] leading-[1.1] font-semibold tracking-[-0.01em] text-balance">
          <span className="min-w-0 break-words">{fitBookName(book.name)}</span>
          <SideTag side={book.color} className="shrink-0 font-sans text-sm font-normal" />
        </h1>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {book.origin.kind === "store" && <PublisherLabel name={book.origin.publisher} verified={storeVerified(book.origin)} />}
          <span>· No ratings yet</span>
        </div>
        <p className="max-w-prose text-sm">{book.description}</p>
        <SaveToLibrary book={book} />
        <StoreCredit book={book} />
      </header>
      <BookFacts summary={book.summary} difficulty={difficulty} ownMoves={ownMoves} />
      <Chapters contents={contents} lines={tree.root.leaves} onPath={onPath} onSelect={select} />
      <Readers />
    </div>
  );
}

/** Save to library, or, once saved, the way to the copy and a second copy (D5: a copy, not a link). */
function SaveToLibrary({ book }: { book: ExampleBook }) {
  const { library, store } = useLibrary();
  const { books: own } = useLibraryBooks();
  const [saving, setSaving] = useState(false);
  const copy = own?.find((entry) => entry.origin.kind === "store" && entry.origin.sourceId === book.id) ?? null;

  const save = async () => {
    setSaving(true);
    try {
      await library.create(exampleDraft(book));
      toast.success(`Saved ${fitBookName(book.name)} to your library.`);
    } catch (caught) {
      toast.error(libraryErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  };

  if (!copy) {
    return (
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <Button size="sm" onClick={() => void save()} disabled={saving || own === null}>
          {saving ? "Saving…" : "Save to library"}
        </Button>
        <span className="text-xs text-muted-foreground">{STORE_NOTES[store]}</span>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className="inline-flex items-center gap-1 text-sm">
        <Check className="size-4" /> In your library
      </span>
      <Button asChild size="sm" variant="outline">
        <Link href={libraryBookHref(copy.id)}>
          Open in Library <JumpTag />
        </Link>
      </Button>
      <Button size="sm" variant="ghost" onClick={() => void save()} disabled={saving} className="text-xs">
        {saving ? "Saving…" : "Save another copy"}
      </Button>
    </div>
  );
}

/**
 * The book's source with its credit where the source asks for one (CC BY-SA: title, author and
 * licence, each linked), or how it was made; "How it was made" opens the rest, such as the
 * changes CC BY-SA asks to be stated, so the page's first lines stay short.
 */
function StoreCredit({ book }: { book: ExampleBook }) {
  const credit = book.attribution;
  return (
    <p className="shrink-0 text-[11px] leading-snug text-muted-foreground">
      {credit ? (
        <>
          Source:{" "}
          <a href={credit.url} target="_blank" rel="noreferrer" className="underline">
            {credit.title}
          </a>
          , by {credit.author} (
          <a href={credit.licenseUrl} target="_blank" rel="noreferrer" className="underline">
            {credit.license}
          </a>
          ).
        </>
      ) : (
        EXAMPLE_METHOD_NOTES[book.method]
      )}{" "}
      <Popover>
        <PopoverTrigger className="font-medium text-foreground underline">How it was made</PopoverTrigger>
        <PopoverContent align="start" className="w-80 text-xs leading-relaxed">
          {credit ? (
            <>
              {EXAMPLE_METHOD_NOTES[book.method]} Retrieved {credit.retrieved}. {credit.changes} A saved copy keeps this credit.
            </>
          ) : (
            <>How it was built: {book.rules}.</>
          )}
        </PopoverContent>
      </Popover>
    </p>
  );
}

/**
 * "In this book": the book's chapters, each opening it names under the one that heads it (or
 * the top openings, when several head it), in tree order. Picking one shows its position. On a
 * short page it gives up height, down to a few rows, before the reviews do.
 */
function Chapters({ contents, lines, onPath, onSelect }: { contents: ContentsEntry[]; lines: number; onPath: ReadonlySet<string>; onSelect: (node: ViewNode) => void }) {
  const top = contents.filter((entry) => entry.level === 0);
  const chapters = top.length === 1 ? contents.filter((entry) => entry.level === 1) : top;
  // A chapter named under another, as "Queen's Gambit Declined: Albin Countergambit" beside
  // "Queen's Gambit Declined", shows only the rest of its name, which is what tells it apart.
  const label = (entry: ContentsEntry) => {
    const under = chapters.find((other) => other !== entry && entry.name.startsWith(`${other.name}: `));
    return under ? shortName(entry.name, under.name) : entry.short;
  };
  return (
    <section aria-labelledby="store-chapters" className="flex min-h-20 flex-col gap-1">
      <div className="flex flex-wrap items-baseline gap-x-2.5">
        <h2 id="store-chapters" className="font-heading text-[19px] leading-tight font-semibold">
          In this book
        </h2>
        <span className="book-sc">
          {countOf(chapters.length, "chapter")} · {countOf(lines, "line")}
        </span>
      </div>
      <div className="max-h-36 min-h-0 overflow-y-auto border-t border-rule [scrollbar-width:thin]">
        {chapters.length ? (
          <div className="grid gap-x-6 @md/book-body:grid-cols-2">
            {chapters.map((entry, i) => (
              <button
                key={entry.node.id}
                type="button"
                aria-current={onPath.has(entry.node.id) ? "true" : undefined}
                onClick={() => onSelect(entry.node)}
                className="grid grid-cols-[1.25rem_minmax(0,1fr)_auto] items-baseline gap-2 border-b border-rule px-0.5 py-1 text-left hover:bg-accent aria-[current]:bg-accent"
              >
                <span className="font-mono text-[11px] text-muted-foreground tabular-nums">{i + 1}</span>
                <span className="truncate font-heading text-[15px]" title={entry.name}>
                  {label(entry)}
                </span>
                <span className="font-mono text-[11px] text-muted-foreground tabular-nums">{entry.lines}</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="px-1 py-2 text-xs text-muted-foreground">The catalog names none of this book&apos;s positions.</p>
        )}
      </div>
    </section>
  );
}

type ReadersTab = "reviews" | "leaders";

/**
 * The book's reviews and its leaderboard in one section, switched between (D22, D24, D18). Until
 * the store has its back end there are neither, so each says how it fills.
 */
function Readers() {
  const [tab, setTab] = useState<ReadersTab>("reviews");
  return (
    <section aria-label="Reviews and leaderboard" className="flex min-h-24 flex-1 flex-col gap-1.5 max-md:min-h-40">
      <div className="flex flex-wrap items-center gap-2">
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={tab}
          onValueChange={(next) => next && setTab(next as ReadersTab)}
          aria-label="Reviews or leaderboard"
        >
          <ToggleGroupItem value="reviews" className="px-2.5">
            Reviews <span className="font-mono text-[11px] text-muted-foreground">0</span>
          </ToggleGroupItem>
          <ToggleGroupItem value="leaders" className="px-2.5">
            Leaderboard
          </ToggleGroupItem>
        </ToggleGroup>
        <span className="grow" />
        {tab === "leaders" && <span className="text-xs text-muted-foreground">Comes with the trainer</span>}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto border-t border-rule [scrollbar-width:thin]">
        <p className="max-w-prose px-1 py-3 text-sm text-muted-foreground">
          {tab === "reviews"
            ? "No reviews yet. Readers who save this book can rate it and write one review each, up to 200 characters, from its page in their library."
            : "No one is on the leaderboard yet. It comes with the trainer: players who drill this book can choose to show their drill stats here."}
        </p>
      </div>
    </section>
  );
}

function RightPage({ book, model }: { book: ExampleBook; model: StoreModel }) {
  const { tree, selected, spineEndId, select, hoveredId, setHoveredId, walk, setWalk, view, setView } = model;
  const highlight = highlightIndex(selected, walk);
  const highlightId = highlight >= 0 ? selected.children[highlight].id : null;
  // The board draws the hovered move of this position, else the one the arrow keys would play.
  const hovered = hoveredId ? tree.byId.get(hoveredId) : undefined;
  const arrow = hovered?.parent === selected ? hovered : highlight >= 0 ? selected.children[highlight] : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <BookPosition
        bookId={null}
        node={selected}
        side={book.color}
        totals={null}
        exits={[]}
        highlightId={highlightId}
        arrow={arrow}
        clash={null}
        onSelect={select}
        onHover={(node) => setHoveredId(node?.id ?? null)}
      />
      <BookDrawing
        tree={tree}
        side={book.color}
        name={fitBookName(book.name)}
        selected={selected}
        spineEndId={spineEndId}
        onSelect={select}
        onHover={(node) => setHoveredId(node?.id ?? null)}
        walk={walk}
        onWalkChange={setWalk}
        view={view}
        onView={setView}
      />
    </div>
  );
}
