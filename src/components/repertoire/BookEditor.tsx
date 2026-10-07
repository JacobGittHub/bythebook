"use client";

import { useState } from "react";
import { useLibrary } from "@/context/Library";
import { START_FEN } from "@/lib/chess/fen";
import { createRootMoveNode } from "@/lib/chess/moveTree";
import { MAX_BOOK_NAME } from "@/lib/library/names";
import { libraryErrorMessage, type LibraryEntry } from "@/lib/library/types";

type Props = {
  onCreated: (book: LibraryEntry) => void;
  onCancel?: () => void;
};

export function BookEditor({ onCreated, onCancel }: Props) {
  const { library } = useLibrary();
  const [name, setName] = useState("");
  const [color, setColor] = useState<"white" | "black">("white");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      // A new book is one empty tree from the starting position.
      const entry = await library.create({
        name,
        color,
        origin: { kind: "own" },
        trees: [createRootMoveNode(START_FEN)],
      });
      onCreated(entry);
    } catch (caught) {
      setError(libraryErrorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">Book name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Ruy Lopez repertoire"
          maxLength={MAX_BOOK_NAME}
          required
          className="w-full rounded-xl border border-[var(--border-card)] bg-[var(--bg-muted)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--text-muted)] focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">Playing as</label>
        <div className="flex gap-2">
          {(["white", "black"] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={`flex-1 rounded-xl py-2 text-sm font-medium transition-colors ${
                color === c ? "btn-primary border border-transparent" : "btn-secondary"
              }`}
            >
              {c.charAt(0).toUpperCase() + c.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting || !name.trim()}
          className="btn-primary flex-1 rounded-xl px-4 py-2 text-sm font-medium"
        >
          {submitting ? "Creating…" : "Create book"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="btn-secondary rounded-xl px-4 py-2 text-sm"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
