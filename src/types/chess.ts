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
