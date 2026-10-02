import { DashboardTree } from "@/components/repertoire/DashboardTree";
import { getViewer } from "@/lib/auth/viewer";
import { listOpeningBooks } from "@/lib/db/openings";

type Props = {
  searchParams: Promise<{ bookId?: string }>;
};

// The visualizations page. It shows the opening tree alone until a second one ships.
export default async function AtlasPage({ searchParams }: Props) {
  const [viewer, { bookId }] = await Promise.all([getViewer(), searchParams]);
  // A guest has no books, so the database isn't asked.
  const books = viewer.signedIn ? await listOpeningBooks() : [];
  const initialBookId = bookId ?? null;

  return (
    <div className="h-[calc(100vh-6rem)] min-h-0">
      <DashboardTree initialBooks={books} initialBookId={initialBookId} />
    </div>
  );
}
