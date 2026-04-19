import { Button } from "@/components/ui/Button";

export function BookEditor() {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6">
      <h3 className="text-lg font-semibold text-slate-900">Book editor</h3>
      <p className="mt-2 text-sm text-slate-600">
        Placeholder editor for naming books, assigning color, and importing lines.
      </p>
      <div className="mt-4">
        <Button variant="secondary">Create book</Button>
      </div>
    </section>
  );
}
