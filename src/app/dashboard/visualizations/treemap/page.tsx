import { DashboardTree } from "@/components/repertoire/DashboardTree";
import { VisualizationLevel } from "@/components/visualizations/VisualizationLevel";

type Props = {
  searchParams: Promise<{ bookId?: string }>;
};

// The Treemap: the opening tree, a page of the Visualizations chapter. The viewer's books are
// read in the browser, from the library.
export default async function TreemapPage({ searchParams }: Props) {
  const { bookId } = await searchParams;

  return (
    <VisualizationLevel id="treemap">
      <DashboardTree initialBookId={bookId ?? null} />
    </VisualizationLevel>
  );
}
