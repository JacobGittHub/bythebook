"use client";

import type { CatalogMatch } from "@/types/chess";

type OpeningCatalogResultsProps = {
  results: CatalogMatch[];
  selectedMatch?: CatalogMatch | null;
  onHighlight: (match: CatalogMatch) => void;
};

export function OpeningCatalogResults({
  results,
  selectedMatch,
  onHighlight,
}: OpeningCatalogResultsProps) {
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-heading text-base font-semibold">Catalog Results</h3>
        <span className="text-xs text-muted-foreground">{results.length} found</span>
      </div>
      <div className="mt-4 space-y-3">
        {results.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Search for an opening name or ECO code to highlight a line.
          </p>
        )}
        {results.map((result) => {
          const isSelected =
            selectedMatch !== null &&
            selectedMatch !== undefined &&
            result.eco === selectedMatch.eco &&
            result.name === selectedMatch.name &&
            result.pgn === selectedMatch.pgn;

          return (
            <article
              key={`${result.eco}-${result.name}-${result.pgn}`}
              className={`rounded-md border p-3 transition-colors ${
                isSelected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-muted"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className={`text-xs font-medium uppercase tracking-[0.18em] ${isSelected ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                    {result.eco}
                  </p>
                  <h4 className="mt-1 text-sm font-semibold">{result.name}</h4>
                </div>
                <span className={`text-xs ${isSelected ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                  {result.moves.length} moves
                </span>
              </div>
              <p className={`mt-2 text-xs leading-6 ${isSelected ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                {result.pgn}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onHighlight(result)}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    isSelected
                      ? "bg-card text-foreground hover:bg-muted"
                      : "bg-primary text-primary-foreground hover:bg-primary/90"
                  }`}
                >
                  Highlight Path
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
