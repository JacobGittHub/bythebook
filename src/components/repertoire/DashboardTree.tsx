"use client";

import { useMemo, useState } from "react";
import { Chess } from "chess.js";
import { OpeningTreeFull, type DisplayNode, type SelectedNodeInfo } from "./OpeningTreeFull";
import { TreeNodePanel } from "./TreeNodePanel";
import { BookEditor } from "./BookEditor";
import { buildDefaultCatalogTree, searchCatalogMatches } from "@/lib/chess/openingCatalog";
import { mergeMoveLineIntoTree, getNodePathByUciLine } from "@/lib/chess/moveTree";
import type { ExplorerMove, MoveNode, OpeningBook } from "@/types/chess";

// ── Constants ────────────────────────────────────────────────────────────────

const MAX_GHOST_NODES = 6;
const MIN_GHOST_GAMES = 200;

// ── Helpers ──────────────────────────────────────────────────────────────────

function fenAfterMove(baseFen: string, uci: string): string {
  try {
    const chess = new Chess(baseFen);
    chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    return chess.fen();
  } catch {
    return baseFen;
  }
}

function removeMoveNodeById(root: MoveNode, targetId: string): MoveNode {
  return {
    ...root,
    children: root.children
      .filter((c) => c.id !== targetId)
      .map((c) => removeMoveNodeById(c, targetId)),
  };
}

function buildGhostNodes(
  parentFen: string,
  parentId: string,
  existingUcis: Set<string | null>,
  explorerMoves: ExplorerMove[],
): DisplayNode[] {
  return explorerMoves
    .filter((m) => m.white + m.draws + m.black >= MIN_GHOST_GAMES)
    .filter((m) => !existingUcis.has(m.uci))
    .slice(0, MAX_GHOST_NODES)
    .map((m) => ({
      id: `ghost:${parentId}:${m.uci}`,
      san: m.san,
      uci: m.uci,
      fen: fenAfterMove(parentFen, m.uci),
      children: [],
      isGhost: true,
    }));
}

// ── Component ────────────────────────────────────────────────────────────────

type Props = {
  initialBooks: OpeningBook[];
  initialBookId: string | null;
};

export function DashboardTree({ initialBooks, initialBookId }: Props) {
  const [books, setBooks] = useState<OpeningBook[]>(initialBooks);
  const [activeBookId, setActiveBookId] = useState<string | null>(initialBookId);
  const [activeMoveNode, setActiveMoveNode] = useState<MoveNode | null>(
    initialBooks.find((b) => b.id === initialBookId)?.moveNode ?? null,
  );
  const [selectedInfo, setSelectedInfo] = useState<SelectedNodeInfo | null>(null);
  const [expandedNodeId, setExpandedNodeId] = useState<string | null>(null);
  const [ghostExpansions, setGhostExpansions] = useState<Map<string, DisplayNode[]>>(new Map());
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const activeBook = books.find((b) => b.id === activeBookId) ?? null;

  // The catalog tree is always visible (computed once, no API calls)
  const catalogTree = useMemo(() => buildDefaultCatalogTree(), []);

  // FENs of positions in the active book — used to highlight book nodes on the catalog tree
  const bookFens = useMemo<Set<string>>(() => {
    const fens = new Set<string>();
    const collect = (node: MoveNode) => {
      fens.add(node.fen);
      node.children.forEach(collect);
    };
    if (activeMoveNode) collect(activeMoveNode);
    return fens;
  }, [activeMoveNode]);

  // ── Search highlight ─────────────────────────────────────────────────────

  const highlightIds = useMemo<Set<string>>(() => {
    if (!searchQuery.trim()) return new Set();
    const matches = searchCatalogMatches(searchQuery.trim().toLowerCase(), 5);
    const ids = new Set<string>();
    for (const match of matches) {
      const path = getNodePathByUciLine(
        catalogTree,
        match.moves.map((m) => m.uci),
      );
      path.forEach((n) => ids.add(n.id));
    }
    return ids;
  }, [searchQuery, activeMoveNode]);

  // ── Book switching ───────────────────────────────────────────────────────

  const switchBook = (bookId: string) => {
    const book = books.find((b) => b.id === bookId);
    if (!book) return;
    setActiveBookId(bookId);
    setActiveMoveNode(book.moveNode);
    setSelectedInfo(null);
    setExpandedNodeId(null);
    setGhostExpansions(new Map());
    setSearchQuery("");
  };

  // ── Save helper ──────────────────────────────────────────────────────────

  const saveTree = async (updatedNode: MoveNode) => {
    if (!activeBookId) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/openings/books/${activeBookId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moveNode: updatedNode }),
      });
      if (!res.ok) throw new Error("Save failed");
      setActiveMoveNode(updatedNode);
      setBooks((prev) =>
        prev.map((b) => (b.id === activeBookId ? { ...b, moveNode: updatedNode } : b)),
      );
    } catch {
      // leave state as-is; user can retry
    } finally {
      setIsSaving(false);
    }
  };

  // ── Node actions ─────────────────────────────────────────────────────────

  const handleNodeSelect = (info: SelectedNodeInfo) => {
    setSelectedInfo(info);
  };

  const handleAddToBook = async () => {
    if (!selectedInfo || !activeMoveNode) return;
    const updated = mergeMoveLineIntoTree(activeMoveNode, selectedInfo.pathMoves);
    // Remove ghost entry for this node now it's saved
    const newGhosts = new Map(ghostExpansions);
    for (const [parentId, children] of newGhosts) {
      newGhosts.set(
        parentId,
        children.filter((c) => c.id !== selectedInfo.id),
      );
    }
    setGhostExpansions(newGhosts);
    setSelectedInfo((prev) => prev ? { ...prev, node: { ...prev.node, isGhost: false } } : null);
    await saveTree(updated);
  };

  const handleRemoveFromBook = async () => {
    if (!selectedInfo || !activeMoveNode) return;
    const updated = removeMoveNodeById(activeMoveNode, selectedInfo.id);
    setSelectedInfo(null);
    await saveTree(updated);
  };

  const handleExpand = (parentNode: DisplayNode, explorerMoves: ExplorerMove[]) => {
    const existingUcis = new Set<string | null>(parentNode.children.map((c) => c.uci));
    const ghosts = buildGhostNodes(parentNode.fen, parentNode.id, existingUcis, explorerMoves);

    if (expandedNodeId === parentNode.id) {
      // Collapse
      setExpandedNodeId(null);
      setGhostExpansions(new Map());
    } else {
      // Expand (replaces any previous expansion)
      setExpandedNodeId(parentNode.id);
      setGhostExpansions(new Map([[parentNode.id, ghosts]]));
    }
  };

  const handleCreateBook = (book: OpeningBook) => {
    setBooks((prev) => [book, ...prev]);
    setShowCreateForm(false);
    switchBook(book.id);
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full min-h-0 gap-3">
      {/* ── Left: controls + tree ── */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
        {/* Top bar */}
        <div className="flex shrink-0 items-center gap-3 rounded-3xl border border-[var(--border-card)] bg-[var(--bg-card)] px-4 py-3">
          {/* Book selector */}
          {books.length > 0 ? (
            <select
              value={activeBookId ?? ""}
              onChange={(e) => { if (e.target.value) switchBook(e.target.value); }}
              className="min-w-0 flex-1 rounded-xl border border-[var(--border-card)] bg-transparent py-1.5 pl-2 pr-6 text-sm font-semibold text-slate-900 focus:outline-none"
            >
              <option value="">— Select a book —</option>
              {books.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.color})
                </option>
              ))}
            </select>
          ) : (
            <span className="flex-1 text-sm text-[var(--text-muted)]">No books yet</span>
          )}

          {/* Search */}
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search opening…"
            className="w-44 rounded-xl border border-[var(--border-card)] bg-slate-50 px-3 py-1.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none"
          />

          {/* Save indicator */}
          {isSaving && (
            <span className="shrink-0 text-xs text-[var(--text-muted)]">Saving…</span>
          )}

          {/* New book */}
          <button
            onClick={() => setShowCreateForm((v) => !v)}
            className="shrink-0 rounded-xl border border-[var(--border-card)] px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            {showCreateForm ? "Cancel" : "+ New book"}
          </button>
        </div>

        {/* Create form (inline, dismissible) */}
        {showCreateForm && (
          <div className="shrink-0 rounded-3xl border border-[var(--border-card)] bg-[var(--bg-card)] p-4">
            <BookEditor onCreated={handleCreateBook} onCancel={() => setShowCreateForm(false)} />
          </div>
        )}

        {/* Tree */}
        <div className="flex-1 min-h-0 overflow-hidden rounded-3xl border border-[var(--border-card)] bg-[var(--bg-card)]">
          <OpeningTreeFull
            moveNode={catalogTree}
            ghostExpansions={ghostExpansions}
            selectedNodeId={selectedInfo?.id ?? null}
            highlightIds={highlightIds}
            bookFens={bookFens}
            onNodeSelect={handleNodeSelect}
          />
        </div>
      </div>

      {/* ── Right: node panel (always visible) ── */}
      <TreeNodePanel
        node={selectedInfo?.node ?? null}
        book={activeBook}
        isExpanded={expandedNodeId === selectedInfo?.id}
        onAddToBook={handleAddToBook}
        onRemoveFromBook={handleRemoveFromBook}
        onExpand={(moves) => selectedInfo && handleExpand(selectedInfo.node, moves)}
        onClose={() => setSelectedInfo(null)}
      />
    </div>
  );
}
