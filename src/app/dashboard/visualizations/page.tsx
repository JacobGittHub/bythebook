import { VisualizationsSpread } from "@/components/visualizations/VisualizationsSpread";

type Props = {
  /** `show` picks a visualization, as the way back from its page does. */
  searchParams: Promise<{ show?: string }>;
};

/** The Visualizations chapter's own page: the visualizations as contents (plans/book-ui.md D18). */
export default async function VisualizationsPage({ searchParams }: Props) {
  const { show } = await searchParams;
  return <VisualizationsSpread initialId={show ?? null} />;
}
