import { RegionMapView } from "@/components/lab/RegionMapView";
import { getViewer } from "@/lib/auth/viewer";
import { listOpeningBooks } from "@/lib/db/openings";

// The Labyrinth: the region map prototype, reached from the Visualizations page.
export default async function LabyrinthPage() {
  const viewer = await getViewer();
  // A guest has no books, so the database isn't asked.
  const books = viewer.signedIn ? await listOpeningBooks() : [];

  return (
    <div className="h-[calc(100dvh-var(--dash-offset))] min-h-0">
      <RegionMapView initialBooks={books} />
    </div>
  );
}
