"use client";

import { useState } from "react";
import { resolvePlan, type ClashChoice, type ExistingBook, type IncomingBook, type PlanItem } from "@/lib/library/copyPlan";
import { MAX_LIBRARY_BOOKS, libraryErrorMessage, type BookDraft } from "@/lib/library/types";

type Props = {
  title: string;
  /** The checklist from `planCopy`. */
  plan: PlanItem[];
  /** What the receiving library holds. */
  existing: ExistingBook[];
  /** Completes "{count} books" on the confirm button, such as "Restore". */
  verb: string;
  /**
   * Saves one book, given as it will be written and as it came; a refusal is shown beside it
   * and the rest carry on.
   */
  save: (draft: BookDraft, source: IncomingBook) => Promise<unknown>;
  /** The button that closes the checklist without saving; "Cancel" when not given. */
  cancelLabel?: string;
  /** Called when the checklist is closed, with how many books were saved. */
  onDone: (saved: number) => void;
};

type Outcome = { saved: boolean; message?: string };

const itemName = (item: PlanItem) => (item.status === "rejected" ? item.name : item.book.name);

/**
 * The checklist that Restore and the copy at sign-in share (plans/deployment.md D22, D23):
 * each incoming book with what will happen to it. A name already in the library is kept as a
 * second book unless the user skips it. Books are saved one at a time.
 */
export function CopyChecklist({ title, plan, existing, verb, save, cancelLabel = "Cancel", onDone }: Props) {
  const [choices, setChoices] = useState<ReadonlyMap<number, ClashChoice>>(new Map());
  const [outcomes, setOutcomes] = useState<ReadonlyMap<number, Outcome> | null>(null);
  const [busy, setBusy] = useState(false);
  const { write, noRoom } = resolvePlan(plan, choices, existing);
  const finished = outcomes !== null && !busy;
  const savedCount = outcomes ? [...outcomes.values()].filter((outcome) => outcome.saved).length : 0;

  const choose = (index: number, choice: ClashChoice) => setChoices((old) => new Map(old).set(index, choice));

  const run = async () => {
    setBusy(true);
    const results = new Map<number, Outcome>();
    for (const { index, draft, source } of write) {
      try {
        await save(draft, source);
        results.set(index, { saved: true });
      } catch (error) {
        results.set(index, { saved: false, message: libraryErrorMessage(error) });
      }
      setOutcomes(new Map(results));
    }
    setOutcomes(new Map(results));
    setBusy(false);
  };

  const describe = (item: PlanItem, index: number) => {
    const outcome = outcomes?.get(index);
    if (outcome) return outcome.saved ? "Saved." : `Not saved: ${outcome.message}`;
    if (noRoom.includes(index)) return `No room: a library holds at most ${MAX_LIBRARY_BOOKS} books.`;
    switch (item.status) {
      case "new":
        return "Will be added.";
      case "present":
        return "Already in this library.";
      case "rejected":
        return `Can't be added: ${item.detail}`;
      case "name_clash": {
        const planned = write.find((entry) => entry.index === index);
        return planned ? `A book has this name, so it will be added as “${planned.draft.name}”.` : "Skipped.";
      }
    }
  };

  return (
    <section className="rounded-3xl border border-[var(--border-card)] bg-[var(--bg-card)] p-5" aria-label={title}>
      <h2 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h2>
      <ul className="mt-3 divide-y divide-[var(--border-card)]">
        {plan.map((item, index) => (
          <li key={index} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
            <span className="min-w-0 flex-1 truncate font-medium text-[var(--text-primary)]">{itemName(item)}</span>
            <span className="text-xs text-[var(--text-muted)]">{describe(item, index)}</span>
            {item.status === "name_clash" && outcomes === null && (
              <select
                aria-label={`What to do with ${item.book.name}`}
                value={choices.get(index) ?? "keep_both"}
                onChange={(event) => choose(index, event.target.value as ClashChoice)}
                className="rounded-lg border border-[var(--border-card)] bg-[var(--bg-card)] py-1 pl-1.5 pr-5 text-xs text-[var(--text-primary)]"
              >
                <option value="keep_both">Keep both</option>
                <option value="skip">Skip</option>
              </select>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {finished ? (
          <>
            <p className="flex-1 text-sm text-[var(--text-muted)]" role="status">
              {savedCount} {savedCount === 1 ? "book" : "books"} saved.
            </p>
            <button type="button" onClick={() => onDone(savedCount)} className="btn-primary rounded-xl px-4 py-2 text-sm font-medium">
              Done
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={run}
              disabled={busy || write.length === 0}
              className="btn-primary rounded-xl px-4 py-2 text-sm font-medium"
            >
              {busy ? "Saving…" : `${verb} ${write.length} ${write.length === 1 ? "book" : "books"}`}
            </button>
            <button
              type="button"
              onClick={() => onDone(savedCount)}
              disabled={busy}
              className="btn-secondary rounded-xl px-4 py-2 text-sm"
            >
              {cancelLabel}
            </button>
          </>
        )}
      </div>
    </section>
  );
}
