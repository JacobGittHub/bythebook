import { redirect } from "next/navigation";
import { SPIKE_BASE } from "./spike";

export default function SpikeIndex() {
  redirect(`${SPIKE_BASE}/overview`);
}
