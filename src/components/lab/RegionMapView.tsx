"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CanvasErrorBoundary } from "@/components/lab/CanvasErrorBoundary";
import { LabSpinner } from "@/components/lab/LabSpinner";
import { LabStats, type LabStatRow, type LabStatValues } from "@/components/lab/LabStats";
import type { RegionFrame } from "@/components/lab/RegionMap";
import { PositionPanel } from "@/components/repertoire/PositionPanel";
import { SignInPrompt } from "@/components/ui/SignInPrompt";
import { useBugReportSection } from "@/context/BugReport";
import { useViewer } from "@/context/Viewer";
import { summarizeMasterGames } from "@/lib/chess/explorerData";
import { START_FEN, toPositionKey } from "@/lib/chess/fen";
import { getNodePathByUciLine, mergeMoveLineIntoTree, removeMoveNodeById } from "@/lib/chess/moveTree";
import { getOpeningForLine } from "@/lib/chess/openingCatalog";
import { formatRootCamera, type RootCamera } from "@/lib/regions/camera";
import type { Move, MoveNode, OpeningBook } from "@/types/chess";

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
  /** The viewer's books. Empty for a guest. */
  initialBooks: OpeningBook[];
  /** Where the map opens, from the page's `?camera=` (a bug report's "Reproduce" address). */
  initialCamera?: RootCamera | null;
};

/**
 * The Labyrinth's page frame: the region map under a title that names the opening the view
 * is inside, with the position panel beside it. The map tells this component its frame
 * position; nothing here reaches into the map.
 */
export function RegionMapView({ initialBooks, initialCamera }: Props) {
  const router = useRouter();
  const { signedIn } = useViewer();
  const statsRef = useRef<LabStatValues>({});
  const cameraRef = useRef<RootCamera | null>(null);
  const lineRef = useRef<HTMLParagraphElement>(null);

  const [frame, setFrame] = useState<RegionFrame | null>(null);
  const [books, setBooks] = useState<OpeningBook[]>(initialBooks);
  const [activeBookId, setActiveBookId] = useState<string | null>(null);
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
  const activeBook = books.find((book) => book.id === activeBookId) ?? null;

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

  const bookPath = activeBook
    ? getNodePathByUciLine(
        activeBook.moveNode,
        moves.map((move) => move.uci),
      )
    : [];
  const inBook = bookPath.length === moves.length + 1;
  // The map's lines start from the start position, so they only fit a book that does too.
  const canEditBook =
    activeBook !== null &&
    moves.length > 0 &&
    toPositionKey(activeBook.rootFen) === toPositionKey(START_FEN);

  const saveTree = async (book: OpeningBook, moveNode: MoveNode) => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/openings/books/${book.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moveNode }),
      });
      if (!res.ok) throw new Error("Save failed");
      setBooks((prev) => prev.map((b) => (b.id === book.id ? { ...b, moveNode } : b)));
    } catch {
      // leave state as-is; user can retry
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddToBook = () => {
    if (activeBook) void saveTree(activeBook, mergeMoveLineIntoTree(activeBook.moveNode, moves));
  };

  const handleRemoveFromBook = () => {
    if (activeBook && inBook) {
      void saveTree(activeBook, removeMoveNodeById(activeBook.moveNode, bookPath[bookPath.length - 1].id));
    }
  };

  const loaded = frame?.status === "loaded" ? frame.data : null;

  return (
    // Wide: the map beside the position panel. Narrow: the panel opens under the map.
    <div className="flex h-full min-h-0 flex-col gap-2 lg:flex-row lg:gap-3">
      {/* ── Left: title bar + map ── */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 lg:gap-3">
        <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 rounded-3xl border border-[var(--border-card)] bg-[var(--bg-card)] px-4 py-2">
          {/* The opening the view is inside, with the moves that reach it underneath. */}
          <div className="min-w-0 flex-1 basis-56">
            <p className="text-[10px] font-medium uppercase tracking-widest text-[var(--text-muted)]">
              Labyrinth · prototype
            </p>
            <h1 className="truncate text-lg font-semibold leading-tight text-[var(--text-primary)]">{title}</h1>
            <p
              ref={lineRef}
              className="overflow-x-auto whitespace-nowrap text-xs text-[var(--text-muted)] [scrollbar-width:none]"
            >
              {moves.length > 0 ? <span className="font-mono">{line}</span> : START_HINT}
            </p>
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {/* Book selector, kept small: here the map is the subject. A guest gets a notice. */}
            {!signedIn ? (
              <SignInPrompt action="add lines to your books" className="text-xs" />
            ) : books.length > 0 ? (
              <label className="flex min-w-0 items-center gap-1.5 text-xs text-[var(--text-muted)]">
                Book
                <select
                  value={activeBookId ?? ""}
                  onChange={(e) => setActiveBookId(e.target.value || null)}
                  className="min-w-0 max-w-40 rounded-lg border border-[var(--border-card)] bg-[var(--bg-card)] py-1 pl-1.5 pr-5 text-xs text-[var(--text-primary)] focus:outline-none"
                >
                  <option value="">None</option>
                  {books.map((book) => (
                    <option key={book.id} value={book.id}>
                      {book.name} ({book.color})
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <span className="text-xs text-[var(--text-muted)]">No books yet</span>
            )}

            {isSaving && <span className="shrink-0 text-xs text-[var(--text-muted)]">Saving…</span>}

            <button
              onClick={() => setPanelChoice(!panelOpen)}
              aria-expanded={panelOpen}
              className="btn-ghost shrink-0 rounded-xl px-2.5 py-1.5 text-xs"
            >
              {panelOpen ? "Hide panel" : "Show panel"}
            </button>

            <Link
              href="/dashboard/visualizations"
              className="btn-ghost shrink-0 rounded-xl px-2.5 py-1.5 text-xs"
            >
              All visualizations
            </Link>
          </div>
        </div>

        {/* The map fills this box whatever size it has, so the canvas never sets its height. */}
        <div className="relative min-h-0 flex-1 overflow-hidden rounded-3xl border border-[var(--border-card)]">
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
        </div>
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
                    <button
                      onClick={handleRemoveFromBook}
                      disabled={isSaving}
                      className="btn-secondary w-full rounded-2xl px-3 py-2 text-sm"
                    >
                      Remove from book
                    </button>
                  ) : (
                    <button
                      onClick={handleAddToBook}
                      disabled={isSaving}
                      className="btn-primary w-full rounded-2xl px-3 py-2 text-sm font-medium"
                    >
                      Add to book
                    </button>
                  ))}

                <button
                  onClick={() => router.push(`/dashboard/explorer?fen=${encodeURIComponent(frame.fen)}`)}
                  className="btn-secondary w-full rounded-2xl px-3 py-2 text-sm"
                >
                  Open in Explorer
                </button>

                {activeBook && (
                  <button
                    onClick={() => router.push(`/dashboard/train/${activeBook.id}`)}
                    className="btn-secondary w-full rounded-2xl px-3 py-2 text-sm"
                  >
                    Train this book
                  </button>
                )}
              </>
            )
          }
        >
          {/* The prototype's numbers and controls, closed until asked for. */}
          <div className="shrink-0 rounded-3xl bg-[var(--bg-sidebar)] px-4 py-3">
            <button
              onClick={() => setStatsOpen((open) => !open)}
              aria-expanded={statsOpen}
              className="flex w-full items-center justify-between text-[10px] font-semibold uppercase tracking-widest text-[var(--bg-sidebar-muted)] hover:text-[var(--bg-sidebar-text)]"
            >
              Map stats and controls
              <span className="text-[9px]">{statsOpen ? "▲" : "▼"}</span>
            </button>
            {statsOpen && (
              <div className="mt-2 flex flex-col gap-2">
                <LabStats statsRef={statsRef} rows={REGION_STATS} />
              <p className="text-xs text-[var(--bg-sidebar-muted)]">{HOW_TO_MOVE}</p>
              </div>
            )}
          </div>
        </PositionPanel>
      )}
    </div>
  );
}
