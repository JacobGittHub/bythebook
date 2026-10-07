"use client";

import { useMemo, useState } from "react";
import { OpeningTreeFull, type DisplayNode, type SelectedNodeInfo } from "./OpeningTreeFull";
import { TreeNodePanel } from "./TreeNodePanel";
import { BookEditor } from "./BookEditor";
import { useLibraryBook, useLibraryBooks } from "@/context/Library";
import { fenAfterUci } from "@/lib/chess/fen";
import { buildDefaultCatalogTree, searchCatalogMatches } from "@/lib/chess/openingCatalog";
import { mergeMoveLineIntoTree, getNodePathByUciLine, removeMoveNodeById } from "@/lib/chess/moveTree";
import { STALE_BOOK_MESSAGE, startTree } from "@/lib/library/trees";
import { libraryErrorMessage, type LibraryEntry } from "@/lib/library/types";
import type { ExplorerMove, MoveNode } from "@/types/chess";

// ── Constants ────────────────────────────────────────────────────────────────

const MAX_GHOST_NODES = 6;
const MIN_GHOST_GAMES = 200;

// ── Helpers ──────────────────────────────────────────────────────────────────

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
      fen: fenAfterUci(parentFen, m.uci) ?? parentFen,
      children: [],
      isGhost: true,
    }));
}

// ── Component ────────────────────────────────────────────────────────────────

type Props = {
  initialBookId: string | null;
};

export function DashboardTree({ initialBookId }: Props) {
  // The viewer's books, a guest's included, from the library (src/context/Library.tsx).
  const { books } = useLibraryBooks();
  const [activeBookId, setActiveBookId] = useState<string | null>(initialBookId);
  const { book: activeBook, saveStartTree } = useLibraryBook(activeBookId);
  const activeMoveNode = useMemo(() => (activeBook ? startTree(activeBook.trees) : null), [activeBook]);
  const [selectedInfo, setSelectedInfo] = useState<SelectedNodeInfo | null>(null);
  const [expandedNodeId, setExpandedNodeId] = useState<string | null>(null);
  const [ghostExpansions, setGhostExpansions] = useState<Map<string, DisplayNode[]>>(new Map());
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

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
  }, [searchQuery, catalogTree]);

  // ── Book switching ───────────────────────────────────────────────────────

  const showBook = (bookId: string) => {
    setActiveBookId(bookId);
    setSelectedInfo(null);
    setExpandedNodeId(null);
    setGhostExpansions(new Map());
    setSearchQuery("");
  };

  // ── Save helper ──────────────────────────────────────────────────────────

  const saveTree = async (updatedNode: MoveNode) => {
    if (!activeBook) return;
    setIsSaving(true);
    try {
      if (!(await saveStartTree(updatedNode))) alert(STALE_BOOK_MESSAGE);
    } catch (error) {
      alert(libraryErrorMessage(error));
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

  const handleCreateBook = (book: LibraryEntry) => {
    setShowCreateForm(false);
    showBook(book.id);
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    // Wide: the tree beside the node panel. Narrow: the panel sits under the tree.
    <div className="flex h-full min-h-0 flex-col gap-2 lg:flex-row lg:gap-3">
      {/* ── Left: controls + tree ── */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 lg:gap-3">
        {/* Top bar */}
        <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-3xl border border-[var(--border-card)] bg-[var(--bg-card)] px-4 py-2.5 lg:gap-3 lg:py-3">
          {/* Book selector */}
          {books === null ? (
            <span className="flex-1 text-sm text-[var(--text-muted)]">Loading books…</span>
          ) : books.length > 0 ? (
            <select
              value={activeBookId ?? ""}
              onChange={(e) => { if (e.target.value) showBook(e.target.value); }}
              className="min-w-0 flex-1 rounded-xl border border-[var(--border-card)] bg-[var(--bg-card)] py-1.5 pl-2 pr-6 text-sm font-semibold text-[var(--text-primary)] focus:outline-none"
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
            className="min-w-0 flex-1 rounded-xl border border-[var(--border-card)] bg-[var(--bg-muted)] px-3 py-1.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none sm:w-44 sm:flex-none"
          />

          {/* Save indicator */}
          {isSaving && (
            <span className="shrink-0 text-xs text-[var(--text-muted)]">Saving…</span>
          )}

          {/* New book */}
          <button
            onClick={() => setShowCreateForm((v) => !v)}
            className="btn-secondary shrink-0 rounded-xl px-3 py-1.5 text-sm"
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
        pathFens={selectedInfo?.pathMoves.map((move) => move.fen) ?? []}
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
