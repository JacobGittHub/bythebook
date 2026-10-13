"use client";

import { useRouter } from "next/navigation";
import { PositionPanel } from "@/components/repertoire/PositionPanel";
import { RemoveFromBookButton } from "@/components/repertoire/RemoveFromBookButton";
import { Button } from "@/components/shadcn/button";
import { summarizeMasterGames } from "@/lib/chess/explorerData";
import { getOpeningForLine } from "@/lib/chess/openingCatalog";
import { useOpeningExplorer } from "@/hooks/useOpeningExplorer";
import type { LibraryEntry } from "@/lib/library/types";
import type { ExplorerMove } from "@/types/chess";
import type { DisplayNode } from "./OpeningTreeFull";

type Props = {
  node: DisplayNode | null;
  /** The positions after each move on the way to the node, which name its opening. */
  pathFens: string[];
  book: LibraryEntry | null;
  /** Whether the book holds the line to the node, which decides between Add and Remove. */
  inBook: boolean;
  isExpanded: boolean;
  onAddToBook: () => void;
  onRemoveFromBook: () => void;
  onExpand: (moves: ExplorerMove[]) => void;
  onClose: () => void;
};

/** The Treemap's side panel: the selected node's position, with the tree's book actions. */
export function TreeNodePanel({
  node,
  pathFens,
  book,
  inBook,
  isExpanded,
  onAddToBook,
  onRemoveFromBook,
  onExpand,
  onClose,
}: Props) {
  const router = useRouter();
  const explorerData = useOpeningExplorer(node?.fen ?? "");
  const openingName = node ? getOpeningForLine(pathFens)?.name : undefined;

  const isRoot = node?.id === "root";

  const moves = explorerData.data?.moves ?? [];

  return (
    <PositionPanel
      position={
        node
          ? { fen: node.fen, title: isRoot ? "Starting Position" : (openingName ?? node.san ?? "Unknown") }
          : null
      }
      emptyTitle="Select a position"
      emptyHint="Click any node in the tree to explore that position."
      book={book}
      masterGames={{
        loading: explorerData.loading,
        // The listed moves only, as this panel has always added them up.
        summary: explorerData.data ? summarizeMasterGames(moves) : null,
        // A 404 is the route's answer to a guest for a position it hasn't saved.
        emptyText:
          explorerData.error === "404"
            ? "Not saved yet. Live lookups need a beta account."
            : "No master game data.",
      }}
      onClose={onClose}
      actions={
        node && (
          <>
            {book &&
              !isRoot &&
              (!inBook ? (
                <Button size="sm" onClick={onAddToBook}>
                  Add line to book
                </Button>
              ) : (
                <RemoveFromBookButton bookName={book.name} onRemove={onRemoveFromBook} />
              ))}

            {explorerData.data && moves.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => onExpand(moves)}>
                {isExpanded ? "Collapse branch" : "Expand branch"}
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/dashboard/explorer?fen=${encodeURIComponent(node.fen)}`)}
            >
              Open in Explorer
            </Button>

            {book && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/dashboard/train/${book.id}`)}
              >
                Train this book
              </Button>
            )}
          </>
        )
      }
    />
  );
}
