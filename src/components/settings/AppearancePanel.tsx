"use client";

import {
  useBackgroundMode,
  type BackgroundMode,
} from "@/context/BackgroundMode";

const MODES: {
  id: BackgroundMode;
  label: string;
  page: string;
  card: string;
  sidebar: string;
}[] = [
  {
    id: "cream",
    label: "Cream",
    page: "#f0ebe0",
    card: "#fdfaf5",
    sidebar: "#0f172a",
  },
  {
    id: "dark",
    label: "Dark",
    page: "#111118",
    card: "#1c1c25",
    sidebar: "#09090e",
  },
  {
    id: "blue",
    label: "Slate",
    page: "#dde4ef",
    card: "#f2f5fb",
    sidebar: "#1a2840",
  },
  {
    id: "green",
    label: "Sage",
    page: "#dce8df",
    card: "#f2f7f3",
    sidebar: "#142018",
  },
  {
    id: "red",
    label: "Terracotta",
    page: "#edddd8",
    card: "#faf4f2",
    sidebar: "#220f0c",
  },
];

export function AppearancePanel() {
  const { mode, setMode } = useBackgroundMode();

  return (
    <div className="flex flex-wrap gap-4">
      {MODES.map((m) => {
        const selected = mode === m.id;
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => setMode(m.id)}
            aria-pressed={selected}
            title={m.label}
            className="group flex flex-col items-center gap-2.5 rounded-2xl p-1.5 transition-transform hover:scale-[1.04] focus-visible:outline-none"
            style={
              selected
                ? {
                    outline: "2.5px solid var(--text-primary)",
                    outlineOffset: "3px",
                  }
                : undefined
            }
          >
            {/* Mini layout preview */}
            <div
              className="h-16 w-28 overflow-hidden rounded-xl border border-black/10 shadow-sm"
              style={{ background: m.page }}
            >
              <div className="flex h-full">
                {/* Sidebar strip */}
                <div
                  className="h-full w-[22%] shrink-0"
                  style={{ background: m.sidebar }}
                />
                {/* Content area */}
                <div className="flex flex-1 items-center justify-center p-1.5">
                  <div
                    className="h-full w-full rounded-lg"
                    style={{ background: m.card }}
                  />
                </div>
              </div>
            </div>

            {/* Label */}
            <span
              className="text-xs font-medium transition-colors"
              style={{ color: selected ? "var(--text-primary)" : "var(--text-muted)" }}
            >
              {m.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
