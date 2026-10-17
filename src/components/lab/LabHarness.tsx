"use client";

import { useState, useRef, useCallback, useMemo, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { ChevronDown, ChevronUp } from "lucide-react";
import { BoardDisplay } from "@/components/board/BoardDisplay";
import { BookSelect, FIRST_EXAMPLE_BOOK } from "@/components/books/BookSelect";
import { useExampleBooks } from "@/components/books/useExampleBooks";
import type { GlobeConfig, RendererStats } from "@/components/lab/GlobeTest";
import type { ChessMapConfig } from "@/components/lab/ChessMap";
import { CanvasErrorBoundary } from "@/components/lab/CanvasErrorBoundary";
import { LabSpinner } from "@/components/lab/LabSpinner";
import { LabStats, type LabStatRow, type LabStatValues } from "@/components/lab/LabStats";
import { Badge } from "@/components/shadcn/badge";
import { Button } from "@/components/shadcn/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/shadcn/toggle-group";
import { useLibraryBook, useLibraryBooks } from "@/context/Library";
import { useViewer } from "@/context/Viewer";
import { EXAMPLE_ID_PREFIX } from "@/lib/books/examples";
import { startTree } from "@/lib/library/trees";
import type { MoveNode } from "@/types/chess";

// ── Lazy canvas ───────────────────────────────────────────────────────────────

const GlobeTest = dynamic(() => import("@/components/lab/GlobeTest"), {
  ssr: false,
  loading: () => <LabSpinner label="Loading canvas…" />,
});

const ChessMap = dynamic(() => import("@/components/lab/ChessMap"), {
  ssr: false,
  loading: () => <LabSpinner label="Loading map…" />,
});

// ── Stats ─────────────────────────────────────────────────────────────────────
// Each view writes its numbers into one shared ref, and `LabStats` reads the rows it is given.

const GLOBE_STATS: LabStatRow[] = [
  { key: "triangles", label: "Triangles" },
  { key: "drawCalls", label: "Draw calls" },
  { key: "geometries", label: "Geometries" },
  { key: "textures", label: "Textures" },
  { key: "nodes", label: "Nodes (meshes)" },
];

const MAP_STATS: LabStatRow[] = [
  { key: "fps", label: "FPS" },
  { key: "nodes", label: "Nodes drawn" },
];

// ── Config defaults ───────────────────────────────────────────────────────────

const DEFAULT_MAP_CONFIG: ChessMapConfig = {
  maxNodes: 200,
  baseBranchLength: 300,
  depthDecay: 0.48,
  retrogradeStrength: 0.55,
  lineWidthMax: 10,
  showGhostLines: true,
};

/**
 * What the globe draws, for every opening (the catalog) and for a book alike. A book is drawn
 * breadth first from its start, up to `nodeCount` positions, whatever `depthShells` says.
 */
const DEFAULT_CONFIG: GlobeConfig = {
  nodeCount: 160,
  rotateSpeed: 0.4,
  nodeSize: 0.07,
  depthShells: 3,
  edgeOpacity: 0.8,
  dataSource: "eco",
  layout: "recursive",
  showLabels: true,
  scaleByWeight: true,
  nodeEntryAnim: "none",
  nodeAnimDuration: 0.4,
  buildAnim: false,
  buildAnimSpeed: 10,
  buildAnimPriority: 0,
  engineBias: 0,
  edgeWidth: 1.5,
  edgeWidthMax: 5,
};

// ── Sidebar primitives ────────────────────────────────────────────────────────

function Divider() {
  return <div className="border-t border-sidebar-border" />;
}

function SideLabel({ children }: { children: ReactNode }) {
  return <span className="text-sidebar-muted-foreground text-xs">{children}</span>;
}

function SideValue({ children }: { children: ReactNode }) {
  return <span className="font-mono tabular-nums text-sidebar-foreground text-xs">{children}</span>;
}

function Slider({
  label, value, min, max, step, note, onChange, display,
}: {
  label: string; value: number; min: number; max: number; step: number;
  note?: string; onChange: (v: number) => void; display?: (v: number) => string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex justify-between">
        <SideLabel>{label}</SideLabel>
        <SideValue>{display ? display(value) : value}</SideValue>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-sidebar-foreground" />
      {note && <p className="text-[10px] text-sidebar-muted-foreground opacity-60">{note}</p>}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between">
      <SideLabel>{label}</SideLabel>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-sidebar-foreground" />
    </label>
  );
}

function Segments<T extends string>({
  label, value, options, onChange,
}: {
  label?: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      {label && <SideLabel>{label}</SideLabel>}
      <div className="flex overflow-hidden rounded-sm border border-sidebar-border text-[11px]">
        {options.map((o) => (
          <button key={o.value} onClick={() => onChange(o.value)}
            className={`flex-1 py-1.5 transition-colors ${
              value === o.value
                ? "bg-sidebar-foreground text-sidebar"
                : "text-sidebar-muted-foreground hover:text-sidebar-foreground"
            }`}
          >{o.label}</button>
        ))}
      </div>
    </div>
  );
}

// Collapsible accordion section
function Section({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="flex flex-col gap-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between py-1 text-[10px] font-semibold uppercase tracking-widest text-sidebar-muted-foreground hover:text-sidebar-foreground"
      >
        {title}
        {open ? <ChevronUp aria-hidden="true" className="size-3" /> : <ChevronDown aria-hidden="true" className="size-3" />}
      </button>
      {open && <div className="flex flex-col gap-2 pb-1">{children}</div>}
    </div>
  );
}

/**
 * The moves every line of a book starts with, and the position after them, where the book first
 * branches. The globe draws from there, since a single move would put the whole book on one
 * spoke, off to one side.
 */
function bookTrunk(root: MoveNode): { moves: string; branch: MoveNode } {
  const sans: string[] = [];
  let node = root;
  while (node.children.length === 1) {
    node = node.children[0];
    const ply = sans.length;
    sans.push(ply % 2 === 0 ? `${ply / 2 + 1}.${node.san}` : `${node.san}`);
  }
  return { moves: sans.join(" "), branch: node };
}

function priorityLabel(v: number) {
  if (v <= 0.05) return "BFS";
  if (v >= 0.95) return "DFS";
  return v.toFixed(2);
}

// ── Harness ───────────────────────────────────────────────────────────────────

/**
 * The prototypes this harness can show. Each has its own page under Visualizations. The
 * region map has its own frame, `RegionMapView`.
 */
export type LabView = "globe" | "map";

const VIEW_TITLES: Record<LabView, string> = {
  globe: "Globe",
  map: "2D map",
};

/**
 * One prototype on its page. The globe draws every named opening or one book, which the reader
 * picks; its display options, and the frame-rate overlay, are for debug mode only.
 */
export function LabHarness({ view }: { view: LabView }) {
  const { debug } = useViewer();
  const [config, setConfig] = useState<GlobeConfig>(DEFAULT_CONFIG);
  const [bookId, setBookId] = useState(FIRST_EXAMPLE_BOOK);
  const showBook = view === "globe" && config.dataSource === "book";
  const { entries, books: examples, failed } = useExampleBooks(showBook ? bookId : null);
  const { books: ownBooks } = useLibraryBooks();
  const isExample = bookId.startsWith(EXAMPLE_ID_PREFIX);
  const { book: ownBook, status: ownStatus } = useLibraryBook(showBook && !isExample ? bookId : null);
  const book = isExample ? (examples.get(bookId) ?? null) : ownBook;
  const trunk = useMemo(() => (book ? bookTrunk(startTree(book.trees)) : null), [book]);
  const bookMissing = isExample
    ? failed && "The example books didn't load."
    : ownStatus === "missing"
      ? "This book isn't in your library."
      : ownStatus === "failed" && "The book couldn't be opened.";
  const [mapConfig, setMapConfig] = useState<ChessMapConfig>(DEFAULT_MAP_CONFIG);
  const [animResetToken, setAnimResetToken] = useState(0);
  const [animProgress, setAnimProgress] = useState({ visible: 0, total: 0 });

  const statsRef = useRef<LabStatValues>({});

  const handleStats = useCallback((s: RendererStats) => { Object.assign(statsRef.current, s); }, []);
  const handleProgress = useCallback((visible: number, total: number) => {
    statsRef.current.nodes = total;
    setAnimProgress({ visible, total });
  }, []);

  const set = (key: keyof GlobeConfig) => (v: number) =>
    setConfig((c) => ({ ...c, [key]: v }));
  const tog = (key: keyof GlobeConfig) => (v: boolean) =>
    setConfig((c) => ({ ...c, [key]: v }));

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 pb-3">
        <div className="flex items-center gap-2">
          <h1 className="font-heading text-[30px] leading-[1.15] font-semibold tracking-[-0.01em]">{VIEW_TITLES[view]}</h1>
          <Badge variant="outline" className="font-normal text-muted-foreground">
            Prototype
          </Badge>
        </div>
        {view === "globe" && (
          <div className="flex flex-wrap items-center gap-2">
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              aria-label="Show"
              value={config.dataSource === "synthetic" ? "" : config.dataSource}
              onValueChange={(next) => {
                if (next === "eco" || next === "book") setConfig((c) => ({ ...c, dataSource: next }));
              }}
            >
              <ToggleGroupItem value="eco" className="px-2.5">All openings</ToggleGroupItem>
              <ToggleGroupItem value="book" className="px-2.5">A book</ToggleGroupItem>
            </ToggleGroup>
            {showBook && <BookSelect value={bookId} onChange={setBookId} examples={entries} ownBooks={ownBooks} />}
          </div>
        )}
        {showBook && trunk?.moves && (
          <p className="basis-full text-xs text-muted-foreground">
            Every line starts <span className="font-mono text-foreground">{trunk.moves}</span>, so the globe starts there.
          </p>
        )}
      </header>

      {/* Body */}
      <div className="flex min-h-0 flex-1 flex-col gap-2 md:flex-row">
        {/* Canvas */}
        <div data-slot="panel" className="relative min-h-80 flex-1 overflow-hidden rounded-md border">
          {view === "globe" && (
            <CanvasErrorBoundary>
              <GlobeTest
                config={config}
                onStats={handleStats}
                animResetToken={animResetToken}
                onProgress={handleProgress}
                bookTree={trunk?.branch ?? null}
                showStats={debug}
              />
            </CanvasErrorBoundary>
          )}
          {showBook && !book && (
            <p className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
              {bookMissing || "Opening the book…"}
            </p>
          )}
          {view === "map" && (
            <CanvasErrorBoundary>
              <ChessMap config={mapConfig} statsRef={statsRef} />
            </CanvasErrorBoundary>
          )}
        </div>

        {/* Sidebar — 2D Map view */}
        {view === "map" && (
          <div className="flex w-52 flex-col gap-2.5 overflow-y-auto rounded-md bg-sidebar p-2.5 text-sidebar-foreground">
            <Section title="Layout" defaultOpen>
              <Slider label="Nodes at 1×" value={mapConfig.maxNodes} min={50} max={800} step={50}
                onChange={(v) => setMapConfig((c) => ({ ...c, maxNodes: v }))}
                note="Zoom in to reveal more detail (LOD)" />
              <Slider label="Branch length" value={mapConfig.baseBranchLength} min={80} max={400} step={10}
                onChange={(v) => setMapConfig((c) => ({ ...c, baseBranchLength: v }))} />
              <Slider label="Depth decay" value={mapConfig.depthDecay} min={0.45} max={0.95} step={0.01}
                onChange={(v) => setMapConfig((c) => ({ ...c, depthDecay: v }))}
                display={(v) => v.toFixed(2)} />
            </Section>
            <Divider />
            <Section title="Branches" defaultOpen>
              <Slider label="Max line width" value={mapConfig.lineWidthMax} min={2} max={20} step={0.5}
                onChange={(v) => setMapConfig((c) => ({ ...c, lineWidthMax: v }))}
                display={(v) => `${v.toFixed(1)}px`} />
              <Slider label="Retrograde" value={mapConfig.retrogradeStrength} min={0} max={1} step={0.05}
                onChange={(v) => setMapConfig((c) => ({ ...c, retrogradeStrength: v }))}
                display={(v) => v.toFixed(2)}
                note="0 = all branches fan outward · 1 = least popular fold fully back" />
              <Toggle label="Ghost lines" checked={mapConfig.showGhostLines}
                onChange={(v) => setMapConfig((c) => ({ ...c, showGhostLines: v }))} />
            </Section>
            <Divider />
            <Section title="Stats" defaultOpen>
              <LabStats statsRef={statsRef} rows={MAP_STATS} />
            </Section>
            <Divider />
            <button
              onClick={() => setMapConfig(DEFAULT_MAP_CONFIG)}
              className="rounded-md bg-sidebar-accent px-2.5 py-1.5 text-xs text-sidebar-muted-foreground transition-colors hover:text-sidebar-foreground"
            >
              Reset defaults
            </button>
          </div>
        )}

        {/* The position picked on the globe, once the globe can be clicked. */}
        {view === "globe" && (
          <aside aria-label="Position" className="flex flex-none flex-col gap-2 md:w-60">
            <div className="flex items-center gap-2">
              <h2 className="book-sc">Position</h2>
              <Badge variant="outline" className="font-normal text-muted-foreground">
                Coming soon
              </Badge>
            </div>
            <div aria-hidden className="pointer-events-none flex flex-col gap-2 opacity-40 grayscale select-none">
              <div className="mx-auto w-full max-w-60">
                <BoardDisplay size="md" />
              </div>
              <Button size="sm" variant="outline" disabled tabIndex={-1}>
                Add to book
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Picking a position on the globe is coming soon. Its board will show here, ready to add to a book.
            </p>
          </aside>
        )}

        {/* Sidebar — Globe view, debug mode only */}
        {view === "globe" && debug && (
          <div className="flex w-52 flex-none flex-col gap-2.5 overflow-y-auto rounded-md bg-sidebar p-2.5 text-sidebar-foreground">

            {/* ── Always-visible quick controls ─────────────────────────── */}
            <Segments
              label="Catalog"
              value={config.dataSource}
              options={[{ value: "synthetic", label: "Synthetic" }, { value: "eco", label: "ECO" }, { value: "book", label: "Book" }]}
              onChange={(v) => setConfig((c) => ({ ...c, dataSource: v }))}
            />
            <Segments
              label="Layout"
              value={config.layout}
              options={[{ value: "fibonacci", label: "Fibonacci" }, { value: "recursive", label: "Recursive" }]}
              onChange={(v) => setConfig((c) => ({ ...c, layout: v }))}
            />
            <div className="flex items-center justify-between">
              <Toggle label="Labels" checked={config.showLabels} onChange={tog("showLabels")} />
              <SideValue>{animProgress.total} nodes</SideValue>
            </div>
            <Toggle label="Scale by popularity" checked={config.scaleByWeight} onChange={tog("scaleByWeight")} />

            <Divider />

            {/* ── Display ────────────────────────────────────────────────── */}
            <Section title="Display" defaultOpen>
              <Slider label="Node count" value={config.nodeCount} min={10} max={500} step={10}
                note="Caps both modes — ECO tree is trimmed to this limit" onChange={set("nodeCount")} />
              <Slider label="Depth shells" value={config.depthShells} min={1} max={6} step={1} onChange={set("depthShells")} />
              <Slider label="Node size" value={config.nodeSize} min={0.02} max={0.25} step={0.01}
                onChange={set("nodeSize")} display={(v) => v.toFixed(2)} />
              <Slider label="Rotation speed" value={config.rotateSpeed} min={0} max={3} step={0.1}
                onChange={set("rotateSpeed")} display={(v) => v.toFixed(1)} />
            </Section>

            <Divider />

            {/* ── Edges ──────────────────────────────────────────────────── */}
            <Section title="Edges" defaultOpen>
              <Slider label="Opacity" value={config.edgeOpacity} min={0} max={1} step={0.05}
                onChange={set("edgeOpacity")} display={(v) => v.toFixed(2)} />
              <Slider label="Width (px)" value={config.edgeWidth} min={0.5} max={8} step={0.25}
                onChange={set("edgeWidth")} display={(v) => `${v.toFixed(2)}px`} />
              {config.scaleByWeight && (
                <Slider label="Max width (px)" value={config.edgeWidthMax} min={1} max={12} step={0.5}
                  onChange={set("edgeWidthMax")} display={(v) => `${v.toFixed(1)}px`} />
              )}
            </Section>

            <Divider />

            {/* ── Nodes ──────────────────────────────────────────────────── */}
            <Section title="Nodes">
              <div className="flex flex-col gap-0.5">
                <SideLabel>Entry animation</SideLabel>
                <select value={config.nodeEntryAnim}
                  onChange={(e) => setConfig((c) => ({ ...c, nodeEntryAnim: e.target.value as typeof config.nodeEntryAnim }))}
                  className="rounded-sm bg-sidebar-accent px-2 py-1 text-xs text-sidebar-foreground"
                >
                  <option value="none">Off</option>
                  <option value="scale">Scale in</option>
                  <option value="hinge">Hinge (arc from grandparent)</option>
                  <option value="split">Split (parent shrinks)</option>
                </select>
              </div>
              {config.nodeEntryAnim !== "none" && (
                <Slider label="Anim duration" value={config.nodeAnimDuration} min={0.1} max={2.0} step={0.05}
                  onChange={set("nodeAnimDuration")} display={(v) => `${v.toFixed(2)} s`} />
              )}
            </Section>

            <Divider />

            {/* ── Build animation ────────────────────────────────────────── */}
            <Section title="Build Animation">
              <Toggle label="Animate build" checked={config.buildAnim} onChange={tog("buildAnim")} />
              {config.buildAnim && (
                <>
                  <Slider label="Speed (nodes/s)" value={config.buildAnimSpeed} min={3} max={20} step={1}
                    onChange={set("buildAnimSpeed")} />
                  <Slider label="BFS ↔ DFS priority" value={config.buildAnimPriority} min={0} max={1} step={0.05}
                    onChange={set("buildAnimPriority")} display={priorityLabel} />
                  <Slider label="Branch importance" value={config.engineBias} min={0} max={1} step={0.05}
                    onChange={set("engineBias")}
                    display={(v) => v === 0 ? "Equal" : v === 1 ? "Max" : v.toFixed(2)} />
                  <div className="flex items-center justify-between">
                    <SideValue>{animProgress.visible} / {animProgress.total}</SideValue>
                    <button onClick={() => setAnimResetToken((t) => t + 1)}
                      className="rounded-sm border border-sidebar-border px-2 py-1 text-[10px] text-sidebar-muted-foreground hover:text-sidebar-foreground">
                      ↺ Restart
                    </button>
                  </div>
                </>
              )}
            </Section>

            <Divider />

            {/* ── Renderer stats ─────────────────────────────────────────── */}
            <Section title="Renderer">
              <LabStats statsRef={statsRef} rows={GLOBE_STATS} />
            </Section>

            <Divider />

            <button onClick={() => { setConfig({ ...DEFAULT_CONFIG, dataSource: config.dataSource }); setAnimResetToken(0); }}
              className="rounded-md bg-sidebar-accent px-2.5 py-1.5 text-xs text-sidebar-muted-foreground transition-colors hover:text-sidebar-foreground">
              Reset defaults
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
