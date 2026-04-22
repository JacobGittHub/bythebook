"use client";

import type { CatalogMatch, MoveNode } from "@/types/chess";

type OpeningCatalogTreePreviewProps = {
  root: MoveNode;
  highlightedNodeIds: string[];
  activeNodeIds: string[];
  selectedMatch?: CatalogMatch | null;
};

function renderNode(
  node: MoveNode,
  depth: number,
  highlightedNodeIds: Set<string>,
  activeNodeIds: Set<string>,
): React.ReactNode {
  if (node.san === null) {
    return node.children.map((child) =>
      renderNode(child, depth, highlightedNodeIds, activeNodeIds),
    );
  }

  const isHighlighted = highlightedNodeIds.has(node.id);
  const isActive = activeNodeIds.has(node.id);

  return (
    <div key={node.id} className="space-y-2">
      <div
        className={`rounded-2xl px-3 py-2 text-sm transition-colors ${
          isHighlighted && isActive
            ? "bg-slate-950 text-white"
            : isActive
              ? "bg-sky-100 text-sky-950"
              : isHighlighted
                ? "bg-amber-100 text-amber-950"
                : "bg-slate-50 text-slate-600"
        }`}
        style={{ marginLeft: `${depth * 18}px` }}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="font-medium">{node.san}</span>
          <span className="text-xs uppercase tracking-[0.14em] opacity-70">
            {isActive && isHighlighted
              ? "active + highlight"
              : isActive
                ? "active"
                : isHighlighted
                  ? "highlight"
                  : "line"}
          </span>
        </div>
      </div>
      {node.children.map((child) =>
        renderNode(child, depth + 1, highlightedNodeIds, activeNodeIds),
      )}
    </div>
  );
}

export function OpeningCatalogTreePreview({
  root,
  highlightedNodeIds,
  activeNodeIds,
  selectedMatch,
}: OpeningCatalogTreePreviewProps) {
  const highlightedSet = new Set(highlightedNodeIds);
  const activeSet = new Set(activeNodeIds);

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4">
      <div>
        <h3 className="text-base font-semibold text-slate-900">Line Preview</h3>
        <p className="mt-1 text-sm text-slate-500">
          {selectedMatch
            ? `${selectedMatch.eco} ${selectedMatch.name}`
            : "Board paths and highlighted catalog lines appear here."}
        </p>
      </div>
      <div className="mt-4 max-h-[24rem] space-y-2 overflow-y-auto pr-1">
        {root.children.length === 0 ? (
          <p className="text-sm text-slate-500">
            Make moves on the board or highlight a catalog result to populate this tree.
          </p>
        ) : (
          root.children.map((child) =>
            renderNode(child, 0, highlightedSet, activeSet),
          )
        )}
      </div>
    </div>
  );
}
