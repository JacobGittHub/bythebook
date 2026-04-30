"use client";

import dynamic from "next/dynamic";
import { useState, useRef, useEffect, useCallback } from "react";
import type { GlobeConfig, RendererStats } from "@/components/lab/GlobeTest";

const GlobeTest = dynamic(() => import("@/components/lab/GlobeTest"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-[var(--text-muted)]">
      Loading canvas…
    </div>
  ),
});

const TABS = ["Globe (R3F)", "React Flow", "Transitions"] as const;
type Tab = (typeof TABS)[number];

const DEFAULT_CONFIG: GlobeConfig = {
  nodeCount: 40,
  rotateSpeed: 0.4,
  nodeSize: 0.07,
  depthShells: 3,
  edgeOpacity: 0.25,
  dataSource: "synthetic",
  layout: "fibonacci",
  showLabels: false,
};

function Slider({
  label,
  value,
  min,
  max,
  step,
  note,
  onChange,
  display,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  note?: string;
  onChange: (v: number) => void;
  display?: (v: number) => string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-xs">
        <span className="text-[var(--bg-sidebar-muted)]">{label}</span>
        <span className="font-mono text-[var(--bg-sidebar-text)]">
          {display ? display(value) : value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-emerald-500"
      />
      {note && <p className="text-[10px] text-[var(--bg-sidebar-muted)] opacity-70">{note}</p>}
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-[var(--bg-sidebar-muted)]">{label}</span>
      <span className="font-mono tabular-nums text-[var(--bg-sidebar-text)]">{value}</span>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--bg-sidebar-muted)]">
      {children}
    </p>
  );
}

export default function LabPage() {
  const [tab, setTab] = useState<Tab>("Globe (R3F)");
  const [config, setConfig] = useState<GlobeConfig>(DEFAULT_CONFIG);

  const statsRef = useRef<RendererStats>({ triangles: 0, drawCalls: 0, geometries: 0, textures: 0 });
  const [rendererStats, setRendererStats] = useState<RendererStats>(statsRef.current);

  const handleStats = useCallback((s: RendererStats) => {
    statsRef.current = s;
  }, []);

  useEffect(() => {
    const id = setInterval(() => setRendererStats({ ...statsRef.current }), 200);
    return () => clearInterval(id);
  }, []);

  const set = (key: keyof GlobeConfig) => (v: number) =>
    setConfig((c) => ({ ...c, [key]: v }));

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      {/* Tab bar */}
      <div className="flex items-center gap-4 pb-3">
        <div>
          <h1 className="text-lg font-semibold">Visual Lab</h1>
          <p className="text-xs text-[var(--text-muted)]">
            FPS/MS/MB overlay top-left of canvas — click to cycle panels
          </p>
        </div>
        <div className="ml-auto flex gap-1">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                tab === t
                  ? "bg-emerald-600 text-white"
                  : "text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 gap-3 overflow-hidden">
        {/* Canvas */}
        <div className="flex-1 overflow-hidden rounded-xl">
          {tab === "Globe (R3F)" && (
            <GlobeTest config={config} onStats={handleStats} />
          )}
          {tab === "React Flow" && (
            <div className="flex h-full items-center justify-center rounded-xl bg-[var(--bg-muted)] text-sm text-[var(--text-muted)]">
              React Flow test — coming soon
            </div>
          )}
          {tab === "Transitions" && (
            <div className="flex h-full items-center justify-center rounded-xl bg-[var(--bg-muted)] text-sm text-[var(--text-muted)]">
              Framer Motion transitions — coming soon
            </div>
          )}
        </div>

        {/* Controls sidebar — Globe tab only */}
        {tab === "Globe (R3F)" && (
          <div className="flex w-56 flex-col gap-5 overflow-y-auto rounded-xl bg-[var(--bg-sidebar)] p-4 text-[var(--bg-sidebar-text)]">
            <div className="flex flex-col gap-3">
              <SectionLabel>Controls</SectionLabel>

              {/* Data source toggle */}
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-[var(--bg-sidebar-muted)]">Data source</span>
                <div className="flex overflow-hidden rounded-lg border border-white/10 text-xs">
                  {(["synthetic", "eco"] as const).map((src) => (
                    <button
                      key={src}
                      onClick={() => setConfig((c) => ({ ...c, dataSource: src }))}
                      className={`flex-1 py-1.5 transition-colors ${
                        config.dataSource === src
                          ? "bg-emerald-600 text-white"
                          : "text-[var(--bg-sidebar-muted)] hover:text-[var(--bg-sidebar-text)]"
                      }`}
                    >
                      {src === "synthetic" ? "Synthetic" : "ECO Catalog"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Layout toggle */}
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-[var(--bg-sidebar-muted)]">Layout</span>
                <div className="flex overflow-hidden rounded-lg border border-white/10 text-xs">
                  {(["fibonacci", "recursive"] as const).map((layout) => (
                    <button
                      key={layout}
                      onClick={() => setConfig((c) => ({ ...c, layout }))}
                      className={`flex-1 py-1.5 transition-colors ${
                        config.layout === layout
                          ? "bg-emerald-600 text-white"
                          : "text-[var(--bg-sidebar-muted)] hover:text-[var(--bg-sidebar-text)]"
                      }`}
                    >
                      {layout === "fibonacci" ? "Fibonacci" : "Recursive"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Labels toggle */}
              <label className="flex cursor-pointer items-center justify-between text-xs">
                <span className="text-[var(--bg-sidebar-muted)]">Show labels</span>
                <input
                  type="checkbox"
                  checked={config.showLabels}
                  onChange={(e) =>
                    setConfig((c) => ({ ...c, showLabels: e.target.checked }))
                  }
                  className="h-4 w-4 accent-emerald-500"
                />
              </label>

              {config.dataSource === "synthetic" && (
                <Slider
                  label="Node count"
                  value={config.nodeCount}
                  min={10}
                  max={500}
                  step={10}
                  note="1 draw call per node — watch Draw calls below"
                  onChange={set("nodeCount")}
                />
              )}
              <Slider
                label="Rotation speed"
                value={config.rotateSpeed}
                min={0}
                max={3}
                step={0.1}
                onChange={set("rotateSpeed")}
                display={(v) => v.toFixed(1)}
              />
              <Slider
                label="Node size"
                value={config.nodeSize}
                min={0.02}
                max={0.25}
                step={0.01}
                onChange={set("nodeSize")}
                display={(v) => v.toFixed(2)}
              />
              <Slider
                label={config.dataSource === "eco" ? "Max depth (ECO)" : "Depth shells"}
                value={config.depthShells}
                min={1}
                max={6}
                step={1}
                note={
                  config.dataSource === "eco"
                    ? "Prunes ECO tree — catalog max is 5"
                    : "Shells = ring layers from globe center"
                }
                onChange={set("depthShells")}
              />
              <Slider
                label="Edge opacity"
                value={config.edgeOpacity}
                min={0}
                max={1}
                step={0.05}
                onChange={set("edgeOpacity")}
                display={(v) => v.toFixed(2)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <SectionLabel>Renderer</SectionLabel>
              <StatRow label="Triangles" value={rendererStats.triangles.toLocaleString()} />
              <StatRow label="Draw calls" value={rendererStats.drawCalls} />
              <StatRow label="Geometries" value={rendererStats.geometries} />
              <StatRow label="Textures" value={rendererStats.textures} />
            </div>

            <div className="flex flex-col gap-2">
              <SectionLabel>Scene</SectionLabel>
              <StatRow label="Source" value={config.dataSource === "eco" ? "ECO catalog" : "Synthetic"} />
              <StatRow label="Draw calls / node" value="1 (mesh)" />
              <StatRow label="Draw calls / edges" value="1 (segments)" />
            </div>

            <button
              onClick={() => setConfig(DEFAULT_CONFIG)}
              className="mt-auto rounded-lg bg-white/5 px-3 py-2 text-xs text-[var(--bg-sidebar-muted)] transition-colors hover:text-[var(--bg-sidebar-text)]"
            >
              Reset defaults
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
