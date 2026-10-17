import { PlaceholderSpread } from "@/components/book/PlaceholderSpread";

/** The trainer's chapter, coming soon (plans/book-ui.md D11). A book's Train button still opens its scaffold session. */
export default function TrainPage() {
  return (
    <PlaceholderSpread
      line="Drills from your books."
      text={[
        "The computer will play into the lines of your books and you answer from memory, with the positions you miss coming back more often.",
        "It will be a spread like the Explorer's: the board on the left page, the drill and your answers on the right.",
      ]}
    />
  );
}
