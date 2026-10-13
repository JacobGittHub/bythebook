import { PuzzleBoard } from "@/components/puzzles/PuzzleBoard";

export default function PuzzlesPage() {
  return (
    <main className="space-y-4">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Puzzle trainer</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tactical reps and attempt tracking live here. Coming soon: the board below is an
          early scaffold with no puzzles loaded yet.
        </p>
      </div>
      <PuzzleBoard />
    </main>
  );
}
