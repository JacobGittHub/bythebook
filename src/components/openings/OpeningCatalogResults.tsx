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
    <div className="rounded-3xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-slate-900">Catalog Results</h3>
        <span className="text-xs text-slate-500">{results.length} found</span>
      </div>
      <div className="mt-4 space-y-3">
        {results.length === 0 && (
          <p className="text-sm text-slate-500">
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
              className={`rounded-2xl border p-4 transition-colors ${
                isSelected
                  ? "border-slate-950 bg-slate-950 text-white"
                  : "border-slate-200 bg-slate-50 text-slate-900"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className={`text-xs font-medium uppercase tracking-[0.18em] ${isSelected ? "text-slate-300" : "text-slate-500"}`}>
                    {result.eco}
                  </p>
                  <h4 className="mt-1 text-sm font-semibold">{result.name}</h4>
                </div>
                <span className={`text-xs ${isSelected ? "text-slate-300" : "text-slate-500"}`}>
                  {result.moves.length} moves
                </span>
              </div>
              <p className={`mt-2 text-xs leading-6 ${isSelected ? "text-slate-200" : "text-slate-600"}`}>
                {result.pgn}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onHighlight(result)}
                  className={`rounded-full px-3 py-2 text-xs font-medium transition-colors ${
                    isSelected
                      ? "bg-white text-slate-950 hover:bg-slate-100"
                      : "bg-slate-950 text-white hover:bg-slate-800"
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
