import type { Metadata } from "next";
import { SpikeFrame } from "./SpikeFrame";
import "./turns.css";

export const metadata: Metadata = { title: "Page turn spike · ByTheBook" };

export default function SpikeLayout({ children }: { children: React.ReactNode }) {
  return <SpikeFrame>{children}</SpikeFrame>;
}
