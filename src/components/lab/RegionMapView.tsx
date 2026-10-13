"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { CanvasErrorBoundary } from "@/components/lab/CanvasErrorBoundary";
import { LabSpinner } from "@/components/lab/LabSpinner";
import { LabStats, type LabStatRow, type LabStatValues } from "@/components/lab/LabStats";
import type { RegionFrame } from "@/components/lab/RegionMap";
import { PositionPanel } from "@/components/repertoire/PositionPanel";
import { RemoveFromBookButton } from "@/components/repertoire/RemoveFromBookButton";
import { Button } from "@/components/shadcn/button";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { Panel, PanelLabel } from "@/components/ui/Panel";
import { useBugReportSection } from "@/context/BugReport";
import { useLibraryBook, useLibraryBooks } from "@/context/Library";
import { summarizeMasterGames } from "@/lib/chess/explorerData";
import { getNodePathByUciLine, mergeMoveLineIntoTree, removeMoveNodeById } from "@/lib/chess/moveTree";
import { getOpeningForLine } from "@/lib/chess/openingCatalog";
import { formatRootCamera, type RootCamera } from "@/lib/regions/camera";
import { STALE_BOOK_MESSAGE, startTree } from "@/lib/library/trees";
import { libraryErrorMessage } from "@/lib/library/types";
import type { Move, MoveNode } from "@/types/chess";

const RegionMap = dynamic(() => import("@/components/lab/RegionMap"), {
  ssr: false,
  loading: () => <LabSpinner label="Loading map…" />,
});

const REGION_STATS: LabStatRow[] = [
  { key: "fps", label: "FPS" },
  { key: "blobs", label: "Blobs drawn" },
  { key: "frameDepth", label: "Frame depth" },
  { key: "layoutMs", label: "Layout time", format: (ms) => `${ms.toFixed(1)} ms` },
  { key: "pending", label: "Pending requests" },
];

/** From this width the panel sits beside the map and is open by default (Tailwind's `lg`). */
const WIDE_QUERY = "(min-width: 64rem)";

function subscribeToWidth(onChange: () => void) {
  const query = window.matchMedia(WIDE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** Under the title before any move, where the line of moves goes. Short enough for a phone. */
const START_HINT = "Zoom into a region to follow its line.";
const HOW_TO_MOVE = "Scroll or pinch to zoom, drag to pan, and click a dashed “Other” to open it.";

/** "1. e4 e5 2. Nf3" */
function formatLine(moves: Move[]) {
  return moves.map((move, ply) => (ply % 2 === 0 ? `${ply / 2 + 1}. ${move.san}` : move.san)).join(" ");
}

/** The last move with its number: "2. Nf3" for White's, "2… Nf6" for Black's. */
function lastMoveLabel(moves: Move[]) {
  const ply = moves.length - 1;
  const number = Math.floor(ply / 2) + 1;
  return `${number}${ply % 2 === 0 ? "." : "…"} ${moves[ply].san}`;
}

type Props = {
  /** Where the map opens, from the page's `?camera=` (a bug report's "Reproduce" address). */
  initialCamera?: RootCamera | null;
};

/**
 * The Labyrinth's page frame: the region map under a title that names the opening the view
 * is inside, with the position panel beside it. The map tells this component its frame
 * position; nothing here reaches into the map.
 */
export function RegionMapView({ initialCamera }: Props) {
  const router = useRouter();
  const statsRef = useRef<LabStatValues>({});
  const cameraRef = useRef<RootCamera | null>(null);
  const lineRef = useRef<HTMLParagraphElement>(null);

  const [frame, setFrame] = useState<RegionFrame | null>(null);
  const { books } = useLibraryBooks();
  const [activeBookId, setActiveBookId] = useState<string | null>(null);
  const { book: activeBook, saveStartTree } = useLibraryBook(activeBookId);
  const [isSaving, setIsSaving] = useState(false);
  /** Null until the viewer chooses: open beside the map on a wide screen, closed under it on a narrow one. */
  const [panelChoice, setPanelChoice] = useState<boolean | null>(null);
  const isWide = useSyncExternalStore(
    subscribeToWidth,
    () => window.matchMedia(WIDE_QUERY).matches,
    () => false,
  );
  const panelOpen = panelChoice ?? isWide;
  const [statsOpen, setStatsOpen] = useState(false);

  const moves = useMemo(() => frame?.moves ?? [], [frame]);

  // ── Title ────────────────────────────────────────────────────────────────

  const title = useMemo(() => {
    if (moves.length === 0) return "Starting position";
    return getOpeningForLine(moves.map((move) => move.fen ?? ""))?.name ?? "Unnamed opening";
  }, [moves]);
  const line = formatLine(moves);

  // What a bug report says about the map. Its address reopens this exact view.
  useBugReportSection(() => {
    const camera = cameraRef.current;
    const stats = statsRef.current;
    return {
      title: "Labyrinth",
      lines: [
        ["Line", line || "start position"],
        ["Frame", frame ? `${frame.id || "root"} (${frame.status})` : "not laid out yet"],
        ["Camera (root frame)", camera ? formatRootCamera(camera) : "not placed yet"],
        ["Position panel", panelOpen ? "open" : "closed"],
        ["Stats panel", statsOpen ? "open" : "closed"],
        ["Book", activeBook ? activeBook.name : "none"],
        [
          "Map stats",
          REGION_STATS.map(({ key, label, format }) => {
            const value = stats[key];
            if (typeof value !== "number") return `${label} ${value ?? "–"}`;
            return `${label} ${format ? format(value) : Math.round(value * 10) / 10}`;
          }).join(", "),
        ],
      ],
      reproduce: camera
        ? `${window.location.pathname}?camera=${formatRootCamera(camera)}`
        : undefined,
    };
  });

  // A long line scrolls sideways. Keep its newest moves in view.
  useEffect(() => {
    const element = lineRef.current;
    if (element) element.scrollLeft = element.scrollWidth;
  }, [line]);

  // ── Book actions ─────────────────────────────────────────────────────────

  // The map's lines start from the starting position, so they edit the book's tree from there.
  const activeTree = useMemo(() => (activeBook ? startTree(activeBook.trees) : null), [activeBook]);
  const bookPath = activeTree
    ? getNodePathByUciLine(
        activeTree,
        moves.map((move) => move.uci),
      )
    : [];
  const inBook = bookPath.length === moves.length + 1;
  const canEditBook = activeBook !== null && moves.length > 0;

  const saveTree = async (tree: MoveNode) => {
    setIsSaving(true);
    try {
      if (!(await saveStartTree(tree))) toast.error(STALE_BOOK_MESSAGE);
    } catch (error) {
      toast.error(libraryErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddToBook = () => {
    if (activeBook && activeTree) void saveTree(mergeMoveLineIntoTree(activeTree, moves));
  };

  const handleRemoveFromBook = () => {
    if (activeBook && activeTree && inBook) {
      void saveTree(removeMoveNodeById(activeTree, bookPath[bookPath.length - 1].id));
    }
  };

  const loaded = frame?.status === "loaded" ? frame.data : null;

  return (
    // Wide: the map beside the position panel. Narrow: the panel opens under the map.
    <div className="flex h-full min-h-0 flex-col gap-2 lg:flex-row">
      {/* ── Left: title bar + map ── */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
        <Panel className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 px-2.5 py-1.5">
          {/* The opening the view is inside, with the moves that reach it underneath. */}
          <div className="min-w-0 flex-1 basis-56">
            <PanelLabel>Labyrinth · prototype</PanelLabel>
            <h1 className="truncate font-heading text-base font-semibold leading-tight">{title}</h1>
            <p
              ref={lineRef}
              className="overflow-x-auto whitespace-nowrap text-xs text-muted-foreground [scrollbar-width:none]"
            >
              {moves.length > 0 ? <span className="font-mono">{line}</span> : START_HINT}
            </p>
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {/* Book selector, kept small: here the map is the subject. */}
            {books === null ? null : books.length > 0 ? (
              <label className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                Book
                <NativeSelect
                  size="sm"
                  value={activeBookId ?? ""}
                  onChange={(e) => setActiveBookId(e.target.value || null)}
                  wrapperClassName="min-w-0 max-w-40"
                  className="h-7 pl-1.5 pr-7 text-xs"
                >
                  <NativeSelectOption value="">None</NativeSelectOption>
                  {books.map((book) => (
                    <NativeSelectOption key={book.id} value={book.id}>
                      {book.name} ({book.color})
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </label>
            ) : (
              <span className="text-xs text-muted-foreground">No books yet</span>
            )}

            {isSaving && <span className="shrink-0 text-xs text-muted-foreground">Saving…</span>}

            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setPanelChoice(!panelOpen)}
              aria-expanded={panelOpen}
            >
              {panelOpen ? "Hide panel" : "Show panel"}
            </Button>

            <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs">
              <Link href="/dashboard/visualizations">All visualizations</Link>
            </Button>
          </div>
        </Panel>

        {/* The map fills this box whatever size it has, so the canvas never sets its height. */}
        <Panel className="min-h-0 flex-1 overflow-hidden">
          <div className="absolute inset-0">
            <CanvasErrorBoundary>
              <RegionMap
                statsRef={statsRef}
                onFrame={setFrame}
                initialCamera={initialCamera}
                cameraRef={cameraRef}
              />
            </CanvasErrorBoundary>
          </div>
        </Panel>
      </div>

      {/* ── Right: the frame's position. Closed, it is not rendered: a hidden board can't animate. ── */}
      {panelOpen && (
        <PositionPanel
          position={
            frame
              ? { fen: frame.fen, title: moves.length > 0 ? lastMoveLabel(moves) : "Starting position" }
              : null
          }
          emptyTitle="Laying out the map…"
          emptyHint="The position the view is inside shows here."
          book={activeBook}
          masterGames={{
            loading: frame?.status === "loading",
            summary: loaded ? summarizeMasterGames(loaded.moves, loaded.totals) : null,
            emptyText:
              frame?.status === "failed" ? "The master games didn't load." : "No master game data.",
          }}
          actions={
            frame && (
              <>
                {canEditBook &&
                  (inBook ? (
                    <RemoveFromBookButton
                      bookName={activeBook.name}
                      disabled={isSaving}
                      onRemove={handleRemoveFromBook}
                    />
                  ) : (
                    <Button size="sm" onClick={handleAddToBook} disabled={isSaving}>
                      Add to book
                    </Button>
                  ))}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/dashboard/explorer?fen=${encodeURIComponent(frame.fen)}`)}
                >
                  Open in Explorer
                </Button>

                {activeBook && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/dashboard/train/${activeBook.id}`)}
                  >
                    Train this book
                  </Button>
                )}
              </>
            )
          }
        >
          {/* The prototype's numbers and controls, closed until asked for. */}
          <div className="shrink-0 rounded-md bg-sidebar px-2.5 py-2">
            <button
              onClick={() => setStatsOpen((open) => !open)}
              aria-expanded={statsOpen}
              className="flex w-full items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted-foreground hover:text-sidebar-foreground"
            >
              Map stats and controls
              {statsOpen ? (
                <ChevronUp aria-hidden="true" className="size-3" />
              ) : (
                <ChevronDown aria-hidden="true" className="size-3" />
              )}
            </button>
            {statsOpen && (
              <div className="mt-1.5 flex flex-col gap-1.5">
                <LabStats statsRef={statsRef} rows={REGION_STATS} />
                <p className="text-xs text-sidebar-muted-foreground">{HOW_TO_MOVE}</p>
              </div>
            )}
          </div>
        </PositionPanel>
      )}
    </div>
  );
}
