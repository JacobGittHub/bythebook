import { PlaceholderSpread } from "@/components/book/PlaceholderSpread";

/** The puzzles' chapter, coming soon (plans/book-ui.md D11). */
export default function PuzzlesPage() {
  return (
    <PlaceholderSpread
      line="Positions to solve."
      text={[
        "Tactical puzzles from the Lichess puzzle database, with your attempts tracked.",
        "It will take the same spread as the trainer: the board on the left page, the puzzle and your attempts on the right.",
      ]}
    />
  );
}
