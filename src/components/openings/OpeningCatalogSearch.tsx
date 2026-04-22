"use client";

type OpeningCatalogSearchProps = {
  query: string;
  onQueryChange: (query: string) => void;
};

export function OpeningCatalogSearch({
  query,
  onQueryChange,
}: OpeningCatalogSearchProps) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4">
      <label className="block text-sm font-medium text-slate-700" htmlFor="opening-search">
        Search openings
      </label>
      <input
        id="opening-search"
        type="text"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="Try Sicilian, Ruy Lopez, B12..."
        className="mt-3 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none ring-0 transition-colors focus:border-slate-400"
      />
      <p className="mt-2 text-xs text-slate-500">
        Search highlights a path. The board stays where it is until you load a line.
      </p>
    </div>
  );
}
