import { RegionMapView } from "@/components/lab/RegionMapView";
import { getViewer } from "@/lib/auth/viewer";
import { listOpeningBooks } from "@/lib/db/openings";
import { parseRootCamera } from "@/lib/regions/camera";

type Props = {
  /** `camera` reopens a view, as a bug report's "Reproduce" address does. */
  searchParams: Promise<{ camera?: string }>;
};

// The Labyrinth: the region map prototype, reached from the Visualizations page.
export default async function LabyrinthPage({ searchParams }: Props) {
  const viewer = await getViewer();
  const { camera } = await searchParams;
  // A guest has no books, so the database isn't asked.
  const books = viewer.signedIn ? await listOpeningBooks() : [];

  return (
    <div className="h-[calc(100dvh-var(--dash-offset))] min-h-0">
      <RegionMapView initialBooks={books} initialCamera={parseRootCamera(camera)} />
    </div>
  );
}
