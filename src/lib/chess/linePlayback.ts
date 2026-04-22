import type { Move } from "@/types/chess";

export type ScriptedBoardCommand =
  | {
      id: string;
      type: "move";
      from: string;
      to: string;
      promotion?: string;
    }
  | {
      id: string;
      type: "undo";
    }
  | {
      id: string;
      type: "reset";
    };

export function isMoveLinePrefix(candidateMoves: Move[], lineMoves: Move[]): boolean {
  if (candidateMoves.length > lineMoves.length) {
    return false;
  }

  return candidateMoves.every((move, index) => lineMoves[index]?.uci === move.uci);
}

export function getCurrentLineIndex(candidateMoves: Move[], lineMoves: Move[]): number {
  return isMoveLinePrefix(candidateMoves, lineMoves) ? candidateMoves.length : -1;
}

export function getRemainingMovesFromLine(candidateMoves: Move[], lineMoves: Move[]): Move[] {
  const currentIndex = getCurrentLineIndex(candidateMoves, lineMoves);
  return currentIndex === -1 ? [] : lineMoves.slice(currentIndex);
}

export function createMoveCommand(move: Move, commandId: string): ScriptedBoardCommand {
  return {
    id: `command-move-${commandId}`,
    type: "move",
    from: move.uci.slice(0, 2),
    to: move.uci.slice(2, 4),
    promotion: move.uci.length > 4 ? move.uci.slice(4) : undefined,
  };
}

export function createUndoCommand(commandId: string): ScriptedBoardCommand {
  return {
    id: `command-undo-${commandId}`,
    type: "undo",
  };
}

export function createResetCommand(commandId: string): ScriptedBoardCommand {
  return {
    id: `command-reset-${commandId}`,
    type: "reset",
  };
}
