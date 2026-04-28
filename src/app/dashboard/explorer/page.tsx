import { OpeningExplorer } from "@/components/openings/OpeningExplorer";

type Props = {
  searchParams: Promise<{ fen?: string }>;
};

export default async function ExplorerPage({ searchParams }: Props) {
  const { fen } = await searchParams;
  return (
    <main className="space-y-6">
      <OpeningExplorer initialFen={fen} />
    </main>
  );
}
