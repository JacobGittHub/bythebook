import { ReactNode } from "react";

export function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex w-fit rounded-full border border-slate-300 bg-white/80 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-slate-600">
      {children}
    </span>
  );
}
