"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { Panel } from "@/components/ui/Panel";
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
      if (!(await saveStartTree(updatedNode))) toast.error(STALE_BOOK_MESSAGE);
    } catch (error) {
      toast.error(libraryErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  // ── Node actions ─────────────────────────────────────────────────────────

  // The selected position's line in the book: the tree draws the catalog, so a catalog
  // position may or may not be in the book, and its id is the catalog's, not the book's.
  const bookPath = useMemo(
    () => (selectedInfo && activeMoveNode ? getNodePathByUciLine(activeMoveNode, selectedInfo.pathMoves.map((m) => m.uci)) : null),
    [selectedInfo, activeMoveNode],
  );
  const inBook = Boolean(selectedInfo && bookPath && bookPath.length === selectedInfo.pathMoves.length + 1);

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
    if (!selectedInfo || !activeMoveNode || !bookPath || !inBook) return;
    const updated = removeMoveNodeById(activeMoveNode, bookPath[bookPath.length - 1].id);
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
    <div className="flex h-full min-h-0 flex-col gap-2 lg:flex-row">
      {/* ── Left: controls + tree ── */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
        {/* Top bar */}
        <Panel className="flex shrink-0 flex-wrap items-center gap-2 px-2.5 py-2">
          {/* Book selector */}
          {books === null ? (
            <span className="flex-1 text-sm text-muted-foreground">Loading books…</span>
          ) : books.length > 0 ? (
            <NativeSelect
              aria-label="Book"
              size="sm"
              value={activeBookId ?? ""}
              onChange={(e) => { if (e.target.value) showBook(e.target.value); }}
              wrapperClassName="min-w-0 flex-1"
              className="h-7 pl-2 pr-7 font-medium"
            >
              <NativeSelectOption value="">— Select a book —</NativeSelectOption>
              {books.map((b) => (
                <NativeSelectOption key={b.id} value={b.id}>
                  {b.name} ({b.color})
                </NativeSelectOption>
              ))}
            </NativeSelect>
          ) : (
            <span className="flex-1 text-sm text-muted-foreground">No books yet</span>
          )}

          {/* Search */}
          <Input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search opening…"
            aria-label="Search openings"
            className="h-7 min-w-0 flex-1 px-2 sm:w-44 sm:flex-none"
          />

          {/* Save indicator */}
          {isSaving && (
            <span className="shrink-0 text-xs text-muted-foreground">Saving…</span>
          )}

          {/* New book */}
          <Button
            variant="outline"
            size="sm"
            className="h-7 shrink-0 px-2.5 text-xs"
            onClick={() => setShowCreateForm((v) => !v)}
          >
            {showCreateForm ? "Cancel" : (
              <>
                <Plus aria-hidden="true" />
                New book
              </>
            )}
          </Button>
        </Panel>

        {/* Create form (inline, dismissible) */}
        {showCreateForm && (
          <Panel className="shrink-0 p-3">
            <BookEditor onCreated={handleCreateBook} onCancel={() => setShowCreateForm(false)} />
          </Panel>
        )}

        {/* Tree */}
        <Panel className="min-h-0 flex-1 overflow-hidden">
          <OpeningTreeFull
            moveNode={catalogTree}
            ghostExpansions={ghostExpansions}
            selectedNodeId={selectedInfo?.id ?? null}
            highlightIds={highlightIds}
            bookFens={bookFens}
            onNodeSelect={handleNodeSelect}
          />
        </Panel>
      </div>

      {/* ── Right: node panel (always visible) ── */}
      <TreeNodePanel
        node={selectedInfo?.node ?? null}
        pathFens={selectedInfo?.pathMoves.map((move) => move.fen) ?? []}
        book={activeBook}
        inBook={inBook}
        isExpanded={expandedNodeId === selectedInfo?.id}
        onAddToBook={handleAddToBook}
        onRemoveFromBook={handleRemoveFromBook}
        onExpand={(moves) => selectedInfo && handleExpand(selectedInfo.node, moves)}
        onClose={() => setSelectedInfo(null)}
      />
    </div>
  );
}
