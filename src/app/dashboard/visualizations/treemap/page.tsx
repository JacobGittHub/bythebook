import { DashboardTree } from "@/components/repertoire/DashboardTree";

type Props = {
  searchParams: Promise<{ bookId?: string }>;
};

// The Treemap: the opening tree, reached from the Visualizations page. The viewer's books
// are read in the browser, from the library.
export default async function TreemapPage({ searchParams }: Props) {
  const { bookId } = await searchParams;

  return (
    <div className="h-[calc(100dvh-var(--dash-offset))] min-h-0">
      <DashboardTree initialBookId={bookId ?? null} />
    </div>
  );
}
