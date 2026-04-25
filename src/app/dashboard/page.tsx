import { listOpeningBooks } from "@/lib/db/openings";
import { DashboardTree } from "@/components/repertoire/DashboardTree";

type Props = {
  searchParams: Promise<{ bookId?: string }>;
};

export default async function DashboardPage({ searchParams }: Props) {
  const [books, { bookId }] = await Promise.all([listOpeningBooks(), searchParams]);
  const initialBookId = bookId ?? null;

  return (
    <div className="h-[calc(100vh-6rem)] min-h-0">
      <DashboardTree initialBooks={books} initialBookId={initialBookId} />
    </div>
  );
}
