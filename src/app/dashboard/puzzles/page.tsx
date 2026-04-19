import { PuzzleBoard } from "@/components/puzzles/PuzzleBoard";

export default function PuzzlesPage() {
  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-slate-950">Puzzle trainer</h1>
        <p className="mt-2 text-slate-600">
          Tactical reps and attempt tracking live here.
        </p>
      </div>
      <PuzzleBoard />
    </main>
  );
}
