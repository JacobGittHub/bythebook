/** The loading mark every prototype shows while its code, or its first layout, is on the way. */
export function LabSpinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div
      role="status"
      className="flex h-full w-full flex-col items-center justify-center gap-3 text-sm text-muted-foreground"
    >
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-foreground" />
      <span>{label}</span>
    </div>
  );
}
