import { START_FEN, normalizeFen } from "@/lib/chess/fen";
import type { Json } from "@/types/database";
import type { Move, MoveNode } from "@/types/chess";

const ROOT_NODE_ID = "root";

function isJsonRecord(value: Json | undefined): value is Record<string, Json | undefined> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function sanitizeIdPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}

export function createRootMoveNode(fen: string = START_FEN): MoveNode {
  return {
    id: ROOT_NODE_ID,
    san: null,
    uci: null,
    fen: normalizeFen(fen),
    children: [],
  };
}

export function createMoveNodeId(parentId: string, uci: string): string {
  return `${parentId}:${sanitizeIdPart(uci)}`;
}

export function isMove(value: Json | undefined): value is Move {
  return Boolean(
    isJsonRecord(value) &&
      typeof value.san === "string" &&
      typeof value.uci === "string" &&
      (value.fen === undefined || typeof value.fen === "string"),
  );
}

export function isMoveNode(value: Json | undefined): value is MoveNode {
  return Boolean(
    isJsonRecord(value) &&
      typeof value.id === "string" &&
      (value.san === null || typeof value.san === "string") &&
      (value.uci === null || typeof value.uci === "string") &&
      typeof value.fen === "string" &&
      Array.isArray(value.children),
  );
}

function normalizeParsedMoveNode(value: Json | undefined, fallbackFen: string, fallbackId: string): MoveNode {
  if (!isMoveNode(value)) {
    return createRootMoveNode(fallbackFen);
  }

  const nodeId = value.id.trim() || fallbackId;
  const nodeFen = normalizeFen(value.fen);

  return {
    id: nodeId,
    san: value.san,
    uci: value.uci,
    fen: nodeFen,
    children: value.children.map((child, index) =>
      normalizeParsedMoveNode(
        child,
        nodeFen,
        value.uci
          ? createMoveNodeId(nodeId, `${value.uci}-${index}`)
          : `${nodeId}:${index}`,
      ),
    ),
  };
}

export function parseMoveNode(value: Json | undefined, fallbackFen: string = START_FEN): MoveNode {
  return normalizeParsedMoveNode(value, fallbackFen, ROOT_NODE_ID);
}

export function buildMoveTreeFromLines(lines: Move[][], rootFen: string = START_FEN): MoveNode {
  const root = createRootMoveNode(rootFen);

  for (const line of lines) {
    let currentNode = root;

    for (const move of line) {
      const existingChild = currentNode.children.find((child) => child.uci === move.uci);
      if (existingChild) {
        currentNode = existingChild;
        continue;
      }

      const childNode: MoveNode = {
        id: createMoveNodeId(currentNode.id, move.uci),
        san: move.san,
        uci: move.uci,
        fen: normalizeFen(move.fen ?? currentNode.fen),
        children: [],
      };

      currentNode.children.push(childNode);
      currentNode = childNode;
    }
  }

  return root;
}

export function countMoveTreeNodes(node: MoveNode): number {
  return 1 + node.children.reduce((total, child) => total + countMoveTreeNodes(child), 0);
}

export function countMoveTreeLines(node: MoveNode): number {
  if (node.children.length === 0) {
    return node.id === ROOT_NODE_ID ? 0 : 1;
  }

  return node.children.reduce((total, child) => total + countMoveTreeLines(child), 0);
}

export function findMoveNodeById(node: MoveNode, targetId: string): MoveNode | null {
  if (node.id === targetId) {
    return node;
  }

  for (const child of node.children) {
    const result = findMoveNodeById(child, targetId);
    if (result) {
      return result;
    }
  }

  return null;
}

export function findChildMoveNodeByUci(node: MoveNode, uci: string): MoveNode | null {
  return node.children.find((child) => child.uci === uci) ?? null;
}

export function cloneMoveTree(node: MoveNode): MoveNode {
  return {
    ...node,
    children: node.children.map(cloneMoveTree),
  };
}

export function mergeMoveLineIntoTree(root: MoveNode, moves: Move[]): MoveNode {
  const nextRoot = cloneMoveTree(root);
  let currentNode = nextRoot;

  for (const move of moves) {
    const existingChild = currentNode.children.find((child) => child.uci === move.uci);

    if (existingChild) {
      currentNode = existingChild;
      continue;
    }

    const childNode: MoveNode = {
      id: createMoveNodeId(currentNode.id, move.uci),
      san: move.san,
      uci: move.uci,
      fen: normalizeFen(move.fen ?? currentNode.fen),
      children: [],
    };

    currentNode.children.push(childNode);
    currentNode = childNode;
  }

  return nextRoot;
}

export function getNodePathById(root: MoveNode, nodeId: string): MoveNode[] {
  if (root.id === nodeId) {
    return [root];
  }

  for (const child of root.children) {
    const childPath = getNodePathById(child, nodeId);

    if (childPath.length > 0) {
      return [root, ...childPath];
    }
  }

  return [];
}

export function getNodePathByUciLine(root: MoveNode, uciMoves: string[]): MoveNode[] {
  const path: MoveNode[] = [root];
  let currentNode = root;

  for (const uci of uciMoves) {
    const matchingChild = currentNode.children.find((child) => child.uci === uci);

    if (!matchingChild) {
      break;
    }

    path.push(matchingChild);
    currentNode = matchingChild;
  }

  return path;
}

export function getNodeIdsForPath(path: MoveNode[]): string[] {
  return path.map((node) => node.id);
}

export function getCurrentNodeByUciLine(root: MoveNode, uciMoves: string[]): MoveNode | null {
  const path = getNodePathByUciLine(root, uciMoves);
  return path[path.length - 1] ?? null;
}
