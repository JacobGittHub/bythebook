import ecoData from "./ecoData.json";

export type EcoOpening = {
  eco: string;
  name: string;
  pgn: string;
};

// Assert the type of the imported JSON
const openings = ecoData as EcoOpening[];

export function getOpeningCatalog(): EcoOpening[] {
  return openings;
}

export function searchOpenings(query: string, maxResults = 50): EcoOpening[] {
  const normalizedQuery = query.toLowerCase().trim();
  if (!normalizedQuery) return [];

  // Filter openings that contain the query string in their name or ECO code
  const matches = openings.filter(o => 
    o.name.toLowerCase().includes(normalizedQuery) || 
    o.eco.toLowerCase().includes(normalizedQuery)
  );

  return matches.slice(0, maxResults);
}

export function getOpeningByEco(eco: string): EcoOpening | undefined {
  return openings.find(o => o.eco.toUpperCase() === eco.toUpperCase());
}
