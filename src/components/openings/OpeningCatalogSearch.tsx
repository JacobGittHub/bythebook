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
    <div className="rounded-md border bg-card p-3">
      <label className="block text-sm font-medium" htmlFor="opening-search">
        Search openings
      </label>
      <input
        id="opening-search"
        type="text"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="Try Sicilian, Ruy Lopez, B12..."
        className="mt-2 w-full rounded-md border bg-muted px-3 py-1.5 text-sm outline-none transition-colors focus:border-ring"
      />
      <p className="mt-2 text-xs text-muted-foreground">
        Search highlights a path. The board stays where it is until you load a line.
      </p>
    </div>
  );
}
