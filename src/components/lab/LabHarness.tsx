"use client";

import { Component, useState, useRef, useEffect, useCallback, type ReactNode } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { GlobeConfig, RendererStats } from "@/components/lab/GlobeTest";
import type { ChessMapConfig } from "@/components/lab/ChessMap";

// ── Error boundary ────────────────────────────────────────────────────────────

class CanvasErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, message: "" };
  }
  static getDerivedStateFromError(e: Error) {
    return { hasError: true, message: e.message };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 rounded-xl bg-[var(--bg-muted)]">
          <p className="text-sm text-red-400">Canvas error</p>
          <p className="max-w-xs text-center text-xs text-[var(--text-muted)]">{this.state.message}</p>
          <button
            onClick={() => this.setState({ hasError: false, message: "" })}
            className="rounded-lg px-3 py-1.5 text-xs text-[var(--text-muted)] ring-1 ring-white/10 hover:text-[var(--text-primary)]"
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Lazy canvas ───────────────────────────────────────────────────────────────

const GlobeTest = dynamic(() => import("@/components/lab/GlobeTest"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-[var(--text-muted)]">
      Loading canvas…
    </div>
  ),
});

const ChessMap = dynamic(() => import("@/components/lab/ChessMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-[var(--text-muted)]">
      Loading map…
    </div>
  ),
});

// ── Config defaults ───────────────────────────────────────────────────────────

const DEFAULT_MAP_CONFIG: ChessMapConfig = {
  maxNodes: 200,
  baseBranchLength: 300,
  depthDecay: 0.48,
  retrogradeStrength: 0.55,
  lineWidthMax: 10,
  showGhostLines: true,
};

const DEFAULT_CONFIG: GlobeConfig = {
  nodeCount: 40,
  rotateSpeed: 0.4,
  nodeSize: 0.07,
  depthShells: 3,
  edgeOpacity: 0.8,
  dataSource: "synthetic",
  layout: "fibonacci",
  showLabels: false,
  scaleByWeight: false,
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
  return <div className="border-t border-white/10" />;
}

function SideLabel({ children }: { children: ReactNode }) {
  return <span className="text-[var(--bg-sidebar-muted)] text-xs">{children}</span>;
}

function SideValue({ children }: { children: ReactNode }) {
  return <span className="font-mono tabular-nums text-[var(--bg-sidebar-text)] text-xs">{children}</span>;
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between">
      <SideLabel>{label}</SideLabel>
      <SideValue>{value}</SideValue>
    </div>
  );
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
        className="w-full accent-emerald-500" />
      {note && <p className="text-[10px] text-[var(--bg-sidebar-muted)] opacity-60">{note}</p>}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between">
      <SideLabel>{label}</SideLabel>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-emerald-500" />
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
      <div className="flex overflow-hidden rounded-lg border border-white/10 text-[11px]">
        {options.map((o) => (
          <button key={o.value} onClick={() => onChange(o.value)}
            className={`flex-1 py-1.5 transition-colors ${
              value === o.value
                ? "bg-emerald-600 text-white"
                : "text-[var(--bg-sidebar-muted)] hover:text-[var(--bg-sidebar-text)]"
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
        className="flex items-center justify-between py-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--bg-sidebar-muted)] hover:text-[var(--bg-sidebar-text)]"
      >
        {title}
        <span className="text-[9px]">{open ? "▲" : "▼"}</span>
      </button>
      {open && <div className="flex flex-col gap-2 pb-1">{children}</div>}
    </div>
  );
}

function priorityLabel(v: number) {
  if (v <= 0.05) return "BFS";
  if (v >= 0.95) return "DFS";
  return v.toFixed(2);
}

// ── Harness ───────────────────────────────────────────────────────────────────

/** The prototypes this harness can show. Each has its own page under Visualizations. */
export type LabView = "globe" | "map";

const VIEW_TITLES: Record<LabView, string> = {
  globe: "Globe (R3F)",
  map: "2D Map",
};

export function LabHarness({ view }: { view: LabView }) {
  const [config, setConfig] = useState<GlobeConfig>(DEFAULT_CONFIG);
  const [mapConfig, setMapConfig] = useState<ChessMapConfig>(DEFAULT_MAP_CONFIG);
  const [animResetToken, setAnimResetToken] = useState(0);
  const [animProgress, setAnimProgress] = useState({ visible: 0, total: 0 });

  const statsRef = useRef<RendererStats>({ triangles: 0, drawCalls: 0, geometries: 0, textures: 0 });
  const [rendererStats, setRendererStats] = useState<RendererStats>(statsRef.current);

  const handleStats = useCallback((s: RendererStats) => { statsRef.current = s; }, []);
  const handleProgress = useCallback((visible: number, total: number) => {
    setAnimProgress({ visible, total });
  }, []);

  useEffect(() => {
    const id = setInterval(() => setRendererStats({ ...statsRef.current }), 200);
    return () => clearInterval(id);
  }, []);

  const set = (key: keyof GlobeConfig) => (v: number) =>
    setConfig((c) => ({ ...c, [key]: v }));
  const tog = (key: keyof GlobeConfig) => (v: boolean) =>
    setConfig((c) => ({ ...c, [key]: v }));

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 pb-3">
        <div>
          <h1 className="text-lg font-semibold">{VIEW_TITLES[view]} · prototype</h1>
          <p className="text-xs text-[var(--text-muted)]">
            {view === "globe"
              ? "Stats overlay top-left — click to cycle FPS / MS / MB"
              : "A possible future visualization, kept as a prototype"}
          </p>
        </div>
        <Link
          href="/dashboard/visualizations"
          className="ml-auto rounded-lg px-3 py-1.5 text-sm text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]"
        >
          ← All visualizations
        </Link>
      </div>

      {/* Body */}
      <div className="flex flex-1 gap-3 overflow-hidden">
        {/* Canvas */}
        <div className="flex-1 overflow-hidden rounded-xl">
          {view === "globe" && (
            <CanvasErrorBoundary>
              <GlobeTest config={config} onStats={handleStats} animResetToken={animResetToken} onProgress={handleProgress} />
            </CanvasErrorBoundary>
          )}
          {view === "map" && (
            <CanvasErrorBoundary>
              <ChessMap config={mapConfig} />
            </CanvasErrorBoundary>
          )}
        </div>

        {/* Sidebar — 2D Map view */}
        {view === "map" && (
          <div className="flex w-52 flex-col gap-3 overflow-y-auto rounded-xl bg-[var(--bg-sidebar)] p-3 text-[var(--bg-sidebar-text)]">
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
            <button
              onClick={() => setMapConfig(DEFAULT_MAP_CONFIG)}
              className="rounded-lg bg-white/5 px-3 py-2 text-xs text-[var(--bg-sidebar-muted)] transition-colors hover:text-[var(--bg-sidebar-text)]"
            >
              Reset defaults
            </button>
          </div>
        )}

        {/* Sidebar — Globe view only */}
        {view === "globe" && (
          <div className="flex w-52 flex-col gap-3 overflow-y-auto rounded-xl bg-[var(--bg-sidebar)] p-3 text-[var(--bg-sidebar-text)]">

            {/* ── Always-visible quick controls ─────────────────────────── */}
            <Segments
              label="Catalog"
              value={config.dataSource}
              options={[{ value: "synthetic", label: "Synthetic" }, { value: "eco", label: "ECO" }]}
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
                  className="rounded-lg bg-white/10 px-2 py-1.5 text-xs text-[var(--bg-sidebar-text)]"
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
                      className="rounded px-2 py-1 text-[10px] text-[var(--bg-sidebar-muted)] ring-1 ring-white/10 hover:text-[var(--bg-sidebar-text)]">
                      ↺ Restart
                    </button>
                  </div>
                </>
              )}
            </Section>

            <Divider />

            {/* ── Renderer stats ─────────────────────────────────────────── */}
            <Section title="Renderer">
              <Row label="Triangles" value={rendererStats.triangles.toLocaleString()} />
              <Row label="Draw calls" value={rendererStats.drawCalls} />
              <Row label="Geometries" value={rendererStats.geometries} />
              <Row label="Textures" value={rendererStats.textures} />
              <Row label="Nodes (meshes)" value={animProgress.total} />
            </Section>

            <Divider />

            <button onClick={() => { setConfig(DEFAULT_CONFIG); setAnimResetToken(0); }}
              className="rounded-lg bg-white/5 px-3 py-2 text-xs text-[var(--bg-sidebar-muted)] transition-colors hover:text-[var(--bg-sidebar-text)]">
              Reset defaults
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
