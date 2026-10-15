import { notFound } from "next/navigation";
import { SPIKE_PAGES, type SpikePage } from "../spike";
import { SpikeBook } from "../SpikeBook";

export function generateStaticParams() {
  return SPIKE_PAGES.map((p) => ({ page: p.key }));
}

export default async function SpikePageRoute({ params }: { params: Promise<{ page: string }> }) {
  const { page } = await params;
  if (!SPIKE_PAGES.some((p) => p.key === page)) notFound();
  return <SpikeBook page={page as SpikePage} />;
}
