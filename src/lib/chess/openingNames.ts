const names: Record<string, string> = {
  C25: "Vienna Game",
  B01: "Scandinavian Defense",
};

export function getOpeningName(ecoCode: string) {
  return names[ecoCode] ?? "Unknown opening";
}
