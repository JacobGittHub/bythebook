"use client";

import { useEffect, useRef, useState } from "react";
import { parseInfoLine, parseBestMove, pvToSan } from "@/lib/chess/stockfishUci";

export type EngineMode = "none" | "light" | "heavy";

export type EngineLine = {
  multipv: number;
  depth: number;
  score: number | null;
  mate: number | null;
  pv: string[];
  pvSan: string[];
};

export type UseEngineResult = {
  lines: EngineLine[];
  isReady: boolean;
  isAnalyzing: boolean;
};

// Heavy uses the multi-threaded lite build — same ~7 MB as single but uses all CPU cores.
// Requires Cross-Origin-Opener-Policy + Cross-Origin-Embedder-Policy headers (set in next.config.ts).
const ENGINE_PATH: Record<Exclude<EngineMode, "none">, string> = {
  light: "/engine/stockfish-18-lite-single.js",
  heavy: "/engine/stockfish-18-lite.js",
};

const DEPTH: Record<Exclude<EngineMode, "none">, number> = {
  light: 15,
  heavy: 22,
};

const MULTIPV: Record<Exclude<EngineMode, "none">, number> = {
  light: 1,
  heavy: 3,
};

export function useEngine(fen: string, mode: EngineMode): UseEngineResult {
  const [lines, setLines] = useState<EngineLine[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // All mutable tracking lives in refs so closures never go stale.
  const workerRef = useRef<Worker | null>(null);
  const isReadyRef = useRef(false);
  const isSearchingRef = useRef(false); // true while between "go" and "bestmove"
  const pendingStopRef = useRef(false); // true when we sent "stop"; next bestmove is the ack
  const currentFenRef = useRef(fen);   // always the latest fen, updated before sending stop/go
  const accumulatedRef = useRef<Record<number, EngineLine>>({});
  const depthRef = useRef(0);

  // Keep currentFenRef in sync even when the mode effect hasn't re-run.
  currentFenRef.current = fen;

  useEffect(() => {
    if (mode === "none") {
      const w = workerRef.current;
      if (w) {
        try { w.postMessage("quit"); } catch { /* worker may already be gone */ }
        w.terminate();
        workerRef.current = null;
      }
      isReadyRef.current = false;
      isSearchingRef.current = false;
      pendingStopRef.current = false;
      accumulatedRef.current = {};
      setLines([]);
      setIsReady(false);
      setIsAnalyzing(false);
      return;
    }

    const depth = DEPTH[mode];
    const multiPv = MULTIPV[mode];
    depthRef.current = depth;

    const worker = new Worker(ENGINE_PATH[mode]);
    workerRef.current = worker;
    accumulatedRef.current = {};

    // Defined inside the effect so it always closes over `worker` and `depth`.
    // Uses currentFenRef.current so it always analyzes the latest position.
    const startAnalysis = () => {
      const f = currentFenRef.current;
      accumulatedRef.current = {};
      setLines([]);
      setIsAnalyzing(true);
      isSearchingRef.current = true;
      worker.postMessage(`position fen ${f}`);
      worker.postMessage(`go depth ${depth}`);
    };

    worker.onmessage = (e: MessageEvent<string>) => {
      const line = typeof e.data === "string" ? e.data : String(e.data);

      if (line === "uciok") {
        worker.postMessage(`setoption name MultiPV value ${multiPv}`);
        worker.postMessage("isready");
        return;
      }

      if (line === "readyok") {
        isReadyRef.current = true;
        setIsReady(true);
        startAnalysis();
        return;
      }

      const info = parseInfoLine(line);
      if (info) {
        // Normalize to white-positive: Stockfish reports from the side to move.
        const turn = currentFenRef.current.split(" ")[1];
        const normalizedScore =
          info.score !== null && turn === "b" ? -info.score : info.score;
        const normalizedMate =
          info.mate !== null && turn === "b" ? -info.mate : info.mate;
        const pvSan = pvToSan(info.pv, currentFenRef.current);
        accumulatedRef.current[info.multipv] = {
          ...info,
          score: normalizedScore,
          mate: normalizedMate,
          pvSan,
        };
        setLines(
          Object.values(accumulatedRef.current).sort((a, b) => a.multipv - b.multipv),
        );
        return;
      }

      if (parseBestMove(line) !== null) {
        isSearchingRef.current = false;
        if (pendingStopRef.current) {
          // This bestmove is the engine's ack to our "stop" command.
          // Restart analysis immediately for the current fen.
          pendingStopRef.current = false;
          startAnalysis();
        } else {
          setIsAnalyzing(false);
        }
      }
    };

    worker.onerror = (err) => console.error("Stockfish worker error:", err);
    worker.postMessage("uci");

    return () => {
      try { worker.postMessage("quit"); } catch { /* ok */ }
      worker.terminate();
      workerRef.current = null;
      isReadyRef.current = false;
      isSearchingRef.current = false;
      pendingStopRef.current = false;
      setIsReady(false);
      setIsAnalyzing(false);
    };
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Restart analysis whenever the position changes.
  useEffect(() => {
    const worker = workerRef.current;
    if (!worker || !isReadyRef.current) {
      // Not ready yet — currentFenRef is already updated above, so when
      // readyok fires it will call startAnalysis() with the latest fen.
      return;
    }

    if (isSearchingRef.current) {
      // Avoid sending duplicate stops if one is already pending.
      if (!pendingStopRef.current) {
        pendingStopRef.current = true;
        worker.postMessage("stop");
      }
      // currentFenRef is up to date; startAnalysis() inside onmessage will pick it up.
    } else {
      // Engine is idle — start fresh immediately.
      accumulatedRef.current = {};
      setLines([]);
      setIsAnalyzing(true);
      isSearchingRef.current = true;
      worker.postMessage(`position fen ${fen}`);
      worker.postMessage(`go depth ${depthRef.current}`);
    }
  }, [fen]); // eslint-disable-line react-hooks/exhaustive-deps

  return { lines, isReady, isAnalyzing };
}
