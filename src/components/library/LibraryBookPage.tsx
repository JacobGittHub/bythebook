"use client";

import { Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { PageEar } from "@/components/book/PageEar";
import { Spread } from "@/components/book/Spread";
import { useBookSelection } from "@/components/books/useBookSelection";
import { Button } from "@/components/shadcn/button";
import { Skeleton } from "@/components/shadcn/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/shadcn/toggle-group";
import { useGameImport } from "@/context/GameImport";
import { useLibrary, useLibraryBook, useLibraryBooks } from "@/context/Library";
import { useHistoryGames } from "@/hooks/useHistoryGames";
import { bookContents, type ContentsEntry } from "@/lib/books/contents";
import { clashesOf, openClashes, picksOf, withPicks, type Clash, type Picks } from "@/lib/books/drills";
import { countOwnMoves, measuredDifficulty, type BookSide } from "@/lib/books/measures";
import type { BookViewId } from "@/lib/books/views";
import { highlightIndex, type Walk } from "@/lib/books/views/camera";
import { buildViewTree, lineText, moveLabel, pathTo, type ViewNode, type ViewTree } from "@/lib/books/viewTree";
import { getOpeningEndingAt } from "@/lib/chess/openingCatalog";
import { compareWithBook, type BookComparison, type BookExit } from "@/lib/history/compareWithBook";
import { chooseGames, recentGames, type HistoryFilter } from "@/lib/history/historyFilter";
import { scoreOf } from "@/lib/history/historyTree";
import type { StoredGame } from "@/lib/history/types";
import { explorerHref, libraryBookHref, libraryHref, storeBookHref } from "@/lib/library/links";
import { STALE_BOOK_MESSAGE, startTree, withStartTree } from "@/lib/library/trees";
import { libraryErrorMessage, type BookPatch, type LibraryBook, type LibraryEntry } from "@/lib/library/types";
import { cn } from "@/lib/utils";
import { BookDrawing, BookPageHead } from "./BookDrawing";
import { BookFacts } from "./BookFacts";
import { BookGamesFilter, type BookSpan } from "./BookGamesFilter";
import { BookMenu } from "./BookMenu";
import { BookTags, OriginLine, SideTag, countOf, originFolio, originShort, positionsOfLimit, storeVerified } from "./BookParts";
import { BookPosition, WhoTag, exitLabel } from "./BookPosition";
import { DEFAULT_READER_VIEW } from "./BookReader";
import { ClashesDialog } from "./ClashesDialog";
import { ResultsBar } from "./GameHistorySection";
import { RemoveMoveButton } from "./RemoveMoveButton";

const count = (n: number) => n.toLocaleString("en-US");
const percent = (score: number | null) => (score === null ? "–" : `${Math.round(score * 100)}%`);
const nameAt = (node: ViewNode) => getOpeningEndingAt(node.fen)?.name ?? null;
const sideName = (side: BookSide) => (side === "white" ? "White" : "Black");

/**
 * A book's own page, the Library's second level, on a whole spread (plans/game-history.md D40,
 * `plans/mockups/book-spread.html`). The left page is the book's front matter and facts, the
 * choice of Plain or Your games with which games, and a list that fills the rest: the book's
 * contents, or where the user's games leave it. The right page is the current position and the
 * book in a view, walked with the arrow keys from anywhere on the page. Clashes opens the dialog
 * that picks the moves to drill. Another book is chosen back in the Library.
 */
export function LibraryBookPage({ bookId }: { bookId: string }) {
  const { label } = useLibrary();
  const { books } = useLibraryBooks();
  const index = books?.findIndex((candidate) => candidate.id === bookId) ?? -1;
  const listed = books?.[index] ?? null;
  const { book, status, save } = useLibraryBook(bookId);
  const missing = books !== null && !listed && status !== "loading";
  const opened = book?.id === bookId ? book : null;
  const entry = listed ?? opened;
  // One spread for the page's whole life, as the book loads too, so its turn isn't cut short.
  const model = useBookModel(opened, entry, save);

  return (
    <>
      <Spread
        left={{
          // Back to the Library with this book picked, where another book is chosen (D40), by
          // the page's ear (plans/book-ui.md D21, D22).
          ear: <PageEar side="left" word="Books" label="Back to all books" href={libraryHref(bookId)} />,
          head: (
            <>
              <span className="grow" />
              <span className="book-sc">Library{books ? ` · ${countOf(books.length, "book")}` : ""}</span>
            </>
          ),
          body: missing ? (
            <p className="py-6 text-sm text-muted-foreground">
              {status === "failed" ? "The book couldn't be opened." : `This book isn't in your library (${label.toLowerCase()}).`}
            </p>
          ) : model ? (
            <LeftPage page={model.page} games={model.games} />
          ) : (
            <Skeleton className="h-64 w-full" />
          ),
          folio: listed && books && (
            <>
              <span className="grow" />
              <span>
                Book {index + 1} of {books.length}
              </span>
            </>
          ),
        }}
        right={{
          head: entry && <BookPageHead name={entry.name} side={entry.color} whose={originShort(entry.origin)} />,
          body: missing ? null : model ? <RightPage page={model.page} /> : <Skeleton className="min-h-64 w-full flex-1" />,
          folio: entry && (
            <>
              <span>{originFolio(entry.origin)}</span>
              <span className="grow" />
              <span>{positionsOfLimit(entry.summary)}</span>
            </>
          ),
        }}
      />
      {model?.dialog}
    </>
  );
}

type Show = "plain" | "games";
type Save = (patch: BookPatch) => Promise<boolean>;
type Off = Pick<HistoryFilter, "offTimes" | "offSources">;

/** What the two pages share. */
type PageModel = {
  book: LibraryBook;
  entry: LibraryEntry;
  save: Save;
  side: BookSide;
  tree: ViewTree;
  clashes: Clash<ViewNode>[];
  selected: ViewNode;
  /** The spine and ribs view's last position on the spine. */
  spineEndId: string | undefined;
  select: (node: ViewNode) => void;
  show: Show;
  setShow: (show: Show) => void;
  comparison: BookComparison | null;
  hoveredId: string | null;
  setHoveredId: (id: string | null) => void;
  walk: Walk | null;
  setWalk: (walk: Walk) => void;
  view: BookViewId;
  setView: (view: BookViewId) => void;
  openClashes: (startId: string | null) => void;
};

/** The user's games and which of them the page compares with the book. */
type GamesModel = {
  all: StoredGame[] | null;
  history: ReturnType<typeof useHistoryGames>;
  filter: HistoryFilter;
  span: BookSpan;
  chosen: StoredGame[] | null;
  setSpan: (span: BookSpan) => void;
  setOff: (off: Off) => void;
};

const NO_TREES: LibraryBook["trees"] = [];

/**
 * The page's state, and what both pages work out from the book and the user's games; null until
 * the book is open.
 */
function useBookModel(book: LibraryBook | null, entry: LibraryEntry | null, save: Save) {
  const side = book?.color ?? "white";
  const trees = book?.trees ?? NO_TREES;
  const [picked, setShow] = useState<Show | null>(null);
  const [span, setSpan] = useState<BookSpan>(12);
  const [off, setOff] = useState<Off>({ offTimes: new Set(), offSources: new Set() });
  const [walk, setWalk] = useState<Walk | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [view, setView] = useState<BookViewId>(DEFAULT_READER_VIEW.large);
  const [dialog, setDialog] = useState<{ open: boolean; startId: string | null }>({ open: false, startId: null });

  const start = useMemo(() => startTree(trees), [trees]);
  const picks = useMemo(() => picksOf(start, side), [start, side]);
  const tree = useMemo(() => buildViewTree(withPicks(start, side, picks)), [start, side, picks]);
  const clashes = useMemo(() => clashesOf(tree.root, side, picks), [tree, side, picks]);
  const history = useHistoryGames();
  const all = history.games;
  // The page opens on the user's games when they have any (D36).
  const show: Show = picked ?? ((history.summary?.games ?? 0) > 0 ? "games" : "plain");
  const filter: HistoryFilter = useMemo(
    () => ({ side, ...off, from: span === "all" || !all ? null : recentGames(all, span).from, to: null }),
    [side, off, span, all],
  );
  const chosen = useMemo(() => (book && all && show === "games" ? chooseGames(all, filter) : null), [book, all, filter, show]);
  const comparison = useMemo(() => (chosen ? compareWithBook(tree, side, chosen.map((game) => game.record)) : null), [chosen, tree, side]);
  // The page opens down the book's main line, as the reader does (`useBookSelection`).
  const selection = useBookSelection(book ? tree : null, book?.id ?? "");
  if (!book || !entry) return null;
  const selected = selection.selected ?? tree.root;

  const savePicks = async (next: Picks) => {
    try {
      const saved = await save({ trees: withStartTree(book.trees, withPicks(start, side, next)) });
      if (saved) toast.success("Saved the moves to drill.");
      else toast.error(STALE_BOOK_MESSAGE);
      return saved;
    } catch (caught) {
      toast.error(libraryErrorMessage(caught));
      return false;
    }
  };

  const page: PageModel = {
    book,
    entry,
    save,
    side,
    tree,
    clashes,
    selected,
    spineEndId: selection.spineEndId ?? undefined,
    select: (node) => {
      selection.select(node);
      setHoveredId(null);
    },
    show,
    setShow,
    comparison,
    hoveredId,
    setHoveredId,
    walk,
    setWalk,
    view,
    setView,
    openClashes: (startId) => setDialog({ open: true, startId }),
  };
  const games: GamesModel = { all, history, filter, span, chosen, setSpan, setOff };
  const dialogElement = (
    <ClashesDialog
      open={dialog.open}
      onOpenChange={(open) => setDialog({ open, startId: dialog.startId })}
      bookName={entry.name}
      tree={tree}
      side={side}
      picks={picks}
      startId={dialog.startId}
      totals={comparison?.totals ?? null}
      gamesNote={
        comparison
          ? `Games and score come from your games as ${sideName(side)} in the games filter: ${span === "all" ? "all time" : `the last ${span} months`}.`
          : null
      }
      onSave={savePicks}
    />
  );
  return { page, games, dialog: dialogElement };
}

function LeftPage({ page, games }: { page: PageModel; games: GamesModel }) {
  const router = useRouter();
  const { book, entry, side, tree, clashes, selected, select, show, setShow, comparison } = page;
  const { all, history, filter, span, chosen, setSpan, setOff } = games;
  const { openDialog } = useGameImport();
  const difficulty = useMemo(() => measuredDifficulty(book.trees, side), [book.trees, side]);
  const ownMoves = useMemo(() => countOwnMoves(book.trees, side), [book.trees, side]);
  const contents = useMemo(() => bookContents(tree, nameAt), [tree]);
  const onPath = new Set(pathTo(selected).map((node) => node.id));
  const storeHref = storeVerified(entry.origin) && entry.origin.kind === "store" ? storeBookHref(entry.origin.sourceId) : null;
  const kept = history.summary?.games ?? 0;
  const total = comparison?.totals.get(tree.root.id);

  let list: ReactNode;
  if (show === "plain") list = <ContentsList contents={contents} onPath={onPath} onSelect={select} />;
  else if (history.summary && kept === 0)
    list = (
      <div className="flex flex-col items-start gap-2 py-2">
        <p className="text-sm">Import your games to see how you&apos;ve done in this book and where you leave it.</p>
        <Button size="sm" variant="outline" onClick={openDialog}>
          <Upload /> Import games
        </Button>
      </div>
    );
  else if (!comparison) list = <Skeleton className="h-40 w-full" />;
  else
    list = (
      <>
        <div className="flex shrink-0 flex-col gap-1">
          <div className="flex flex-wrap items-baseline gap-x-2.5">
            <span className="font-heading text-[22px] leading-none font-semibold tabular-nums">{count(comparison.games)}</span>
            <span className="text-muted-foreground">of your games as {sideName(side)}</span>
            <span className="grow" />
            <span className="text-xs text-muted-foreground">
              Score <b className="text-foreground tabular-nums">{percent(total ? scoreOf(total) : null)}</b> · {count(comparison.reachedEnd)} reached a
              line&apos;s end
            </span>
          </div>
          {total && <ResultsBar results={total} />}
        </div>
        <ExitsList exits={comparison.exits} selected={selected} onSelect={select} />
      </>
    );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <header className="flex shrink-0 flex-col gap-2">
        <h1 className="flex flex-wrap items-baseline gap-x-3 font-heading text-[32px] leading-[1.1] font-semibold tracking-[-0.01em] text-balance">
          <span className="min-w-0 break-words">{entry.name}</span>
          <SideTag side={side} className="shrink-0 font-sans text-sm font-normal" />
        </h1>
        <BookTags origin={entry.origin} summary={entry.summary} />
        {/* Where it came from, with its source's credit (D24), and the way to its store page. */}
        <div className="text-xs text-muted-foreground">
          <OriginLine origin={entry.origin} className="inline" />
          {storeHref && (
            <>
              {" "}
              <Link href={storeHref} className="font-bold text-foreground underline">
                Open in the Bookstore
              </Link>
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button asChild size="sm">
            <Link href={explorerHref({ bookId: book.id })}>Open in Explorer</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href={`/dashboard/train/${book.id}`}>Train this book</Link>
          </Button>
          <BookMenu book={entry} onDeleted={() => router.push(libraryHref())} onDuplicated={(copy) => router.push(libraryBookHref(copy.id))} />
        </div>
      </header>
      <BookFacts
        summary={entry.summary}
        difficulty={difficulty}
        ownMoves={ownMoves}
        toResolve={openClashes(clashes).length}
        onClashes={() => page.openClashes(null)}
      />
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Show</span>
        <ToggleGroup type="single" variant="outline" size="sm" value={show} onValueChange={(next) => next && setShow(next as Show)} aria-label="Show">
          <ToggleGroupItem value="plain" className="px-2.5">
            Plain
          </ToggleGroupItem>
          <ToggleGroupItem value="games" className="px-2.5">
            Your games
          </ToggleGroupItem>
          <ToggleGroupItem value="drills" disabled className="px-2.5">
            Drills <span className="rounded-sm border px-1 font-mono text-[9.5px] uppercase">soon</span>
          </ToggleGroupItem>
        </ToggleGroup>
        {show === "games" && all && chosen && kept > 0 && (
          <BookGamesFilter
            games={all}
            imports={history.summary?.imports ?? []}
            side={side}
            filter={filter}
            span={span}
            chosen={chosen.filter((game) => game.record.color === side).length}
            onSpan={setSpan}
            onChange={setOff}
          />
        )}
      </div>
      {list}
    </div>
  );
}

/** The book's contents (`bookContents`): each opening it names, nested in tree order, undrilled ones greyed. */
function ContentsList({ contents, onPath, onSelect }: { contents: ContentsEntry[]; onPath: ReadonlySet<string>; onSelect: (node: ViewNode) => void }) {
  return (
    <section aria-labelledby="book-contents" className="flex min-h-0 flex-1 flex-col gap-1">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="book-contents" className="font-heading text-[19px] leading-tight font-semibold">
          Contents
        </h2>
        <span className="book-sc">{countOf(contents.length, "opening")} · lines · positions</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto border-t border-rule [scrollbar-width:thin] max-md:max-h-80">
        {contents.length ? (
          contents.map((entry) => (
            <button
              key={entry.node.id}
              type="button"
              aria-current={onPath.has(entry.node.id) ? "true" : undefined}
              onClick={() => onSelect(entry.node)}
              className="grid w-full grid-cols-[minmax(0,1fr)_auto_3.25rem] items-baseline gap-2.5 border-b border-rule px-1 py-1 text-left hover:bg-accent aria-[current]:bg-accent"
            >
              <span
                className={cn("flex min-w-0 items-baseline gap-1.5 font-heading", entry.node.undrilled && "text-muted-foreground")}
                style={{ paddingLeft: `${Math.min(entry.level, 3) * 1.125}rem`, fontSize: `${15 - Math.min(entry.level, 3) * 0.5}px` }}
              >
                <span className="truncate">{entry.short}</span>
                <span className="shrink-0 font-mono text-[11.5px] text-muted-foreground">{moveLabel(entry.node)}</span>
                <span aria-hidden="true" className="min-w-3 flex-1 -translate-y-1 border-b border-dotted border-border" />
              </span>
              <span className="text-right font-mono text-[11.5px] text-muted-foreground tabular-nums">{entry.lines}</span>
              <span className="text-right font-mono text-[11.5px] text-muted-foreground tabular-nums">{entry.positions}</span>
            </button>
          ))
        ) : (
          <p className="px-1 py-2 text-xs text-muted-foreground">The catalog names none of this book&apos;s positions.</p>
        )}
      </div>
    </section>
  );
}

/** Where the user's games leave the book, most games first; picking one shows its position. */
function ExitsList({ exits, selected, onSelect }: { exits: BookExit[]; selected: ViewNode; onSelect: (node: ViewNode) => void }) {
  return (
    <section aria-labelledby="book-exits" className="flex min-h-0 flex-1 flex-col gap-1">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="book-exits" className="font-heading text-[19px] leading-tight font-semibold">
          Where you leave this book
        </h2>
        <span className="book-sc">{countOf(exits.length, "place")}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto border-t border-rule [scrollbar-width:thin] max-md:max-h-80">
        {exits.length ? (
          exits.map((exit) => {
            const after = pathTo(exit.from).slice(1);
            return (
              <button
                key={`${exit.from.id} ${exit.uci}`}
                type="button"
                aria-current={exit.from === selected ? "true" : undefined}
                onClick={() => onSelect(exit.from)}
                className="grid w-full grid-cols-[4.5rem_3.5rem_minmax(0,1fr)_2.5rem] items-center gap-2 border-b border-rule px-1 py-1 text-left text-[12.5px] hover:bg-accent aria-[current]:bg-accent sm:grid-cols-[4.5rem_3.5rem_minmax(0,1fr)_2.5rem_4.5rem_2.25rem]"
              >
                <WhoTag by={exit.by} />
                <b className="font-mono font-medium">{exit.san ? exitLabel(exit) : exit.uci}</b>
                <span className="truncate text-muted-foreground">
                  after {after.length ? lineText(after.slice(-3)) : "the start"}; the book has{" "}
                  {exit.from.children
                    .slice(0, 2)
                    .map((child) => child.san)
                    .join(", ")}
                </span>
                <span className="text-right font-mono text-xs tabular-nums">{count(exit.games)}</span>
                <ResultsBar results={exit.tally} className="h-1.5 max-sm:hidden" />
                <span className="text-right font-mono text-xs tabular-nums max-sm:hidden">{percent(scoreOf(exit.tally))}</span>
              </button>
            );
          })
        ) : (
          <p className="px-1 py-2 text-xs text-muted-foreground">None of the chosen games left the book.</p>
        )}
      </div>
    </section>
  );
}

function RightPage({ page }: { page: PageModel }) {
  const { book, save, side, tree, clashes, selected, spineEndId, select, comparison, hoveredId, setHoveredId, walk, setWalk, view, setView } = page;
  const highlight = highlightIndex(selected, walk);
  const highlightId = highlight >= 0 ? selected.children[highlight].id : null;
  // The board draws the hovered move of this position, else the one the arrow keys would play.
  const hovered = hoveredId ? tree.byId.get(hoveredId) : undefined;
  const arrow = hovered?.parent === selected ? hovered : highlight >= 0 ? selected.children[highlight] : null;
  const clashHere = clashes.find((clash) => clash.node.id === selected.id)?.state ?? null;
  const success = useMemo(() => {
    if (!comparison) return undefined;
    const scores = new Map<string, number | null>();
    for (const node of tree.nodes) {
      const at = comparison.totals.get(node.id);
      scores.set(node.id, at ? scoreOf(at) : null);
    }
    return scores;
  }, [comparison, tree]);
  const thickness = useMemo(() => (comparison ? new Map([...comparison.totals].map(([id, at]) => [id, at.games])) : undefined), [comparison]);
  const exitsHere = comparison ? comparison.exits.filter((exit) => exit.from === selected) : [];
  const anyUndrilled = tree.nodes.some((node) => node.undrilled);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <BookPosition
        bookId={book.id}
        node={selected}
        side={side}
        totals={comparison?.totals ?? null}
        exits={exitsHere}
        highlightId={highlightId}
        arrow={arrow}
        clash={clashHere}
        onClash={() => page.openClashes(selected.id)}
        onSelect={select}
        onHover={(node) => setHoveredId(node?.id ?? null)}
        actions={<RemoveMoveButton book={book} node={selected} save={save} />}
      />
      <BookDrawing
        tree={tree}
        side={side}
        name={book.name}
        selected={selected}
        spineEndId={spineEndId}
        onSelect={select}
        onHover={(node) => setHoveredId(node?.id ?? null)}
        walk={walk}
        onWalkChange={setWalk}
        view={view}
        onView={setView}
        success={success}
        thickness={thickness}
        legend={
          comparison ? (
            <span className="flex items-center gap-1.5">
              Your score
              <span className="inline-block h-[7px] w-16 rounded-sm bg-[linear-gradient(90deg,var(--destructive),var(--bar-draw),var(--success))]" />
              30% → 70%+ · thickness: games
            </span>
          ) : (
            anyUndrilled && (
              <span className="flex items-center gap-1.5">
                <span aria-hidden="true" className="inline-block w-5 border-t-[1.5px] border-dashed border-muted-foreground" />
                not drilled
              </span>
            )
          )
        }
      />
    </div>
  );
}
