export type Move = {
  san: string;
  uci: string;
  fen?: string;
};

export type MoveNode = {
  id: string;
  san: string | null;
  uci: string | null;
  fen: string;
  children: MoveNode[];
};

export type MoveNodeState = "default" | "highlighted" | "active" | "transient";

export type ExplorerMatchMode = "prefix" | "position" | "none";

export type CatalogMatch = {
  eco: string;
  name: string;
  pgn: string;
  moves: Move[];
  moveNode: MoveNode;
};

export type ParsedCatalogMove = {
  san: string;
  uci: string;
  fen: string;
  positionKey: string;
};

export type GeneratedCatalogOpening = {
  id: string;
  eco: string;
  name: string;
  pgn: string;
  normalizedEco: string;
  normalizedName: string;
  normalizedPgn: string;
  moves: ParsedCatalogMove[];
  finalFen: string;
  finalPositionKey: string;
};

export type GeneratedOpeningCatalog = {
  version: 2;
  generatedAt: string;
  sourceCount: number;
  openings: GeneratedCatalogOpening[];
  indexes: {
    byEco: Record<string, string[]>;
    byUciPrefix: Record<string, string[]>;
    byPositionKey: Record<string, string[]>;
  };
};

export type CatalogLinePreview = {
  root: MoveNode;
  highlightedNodeIds: string[];
  activeNodeIds: string[];
};

export type Position = {
  fen: string;
  turn: "w" | "b";
  moves: Move[];
};

export type OpeningBook = {
  id: string;
  name: string;
  color: "white" | "black";
  description?: string;
  rootFen: string;
  moveNode: MoveNode;
};

export type ExplorerMove = {
  san: string;
  uci: string;
  white: number;
  draws: number;
  black: number;
};

export type OpeningInfo = {
  eco?: string;
  name?: string;
};

export type ExplorerResponse = {
  moves: ExplorerMove[];
  opening?: OpeningInfo;
};
