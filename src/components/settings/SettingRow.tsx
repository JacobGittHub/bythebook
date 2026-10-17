import type { ReactNode } from "react";

/**
 * One setting on the Settings page (plans/book-ui.md D10): its name at the left, ruled off from
 * the one above, with its control and a note beside it.
 */
export function SettingRow({
  label,
  labelId,
  note,
  children,
}: {
  label: string;
  /** The name's id, for a control that is labelled by it. */
  labelId?: string;
  note?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)] items-start gap-x-3.5 gap-y-1.5 border-t border-rule py-3.5 max-[420px]:grid-cols-1">
      <h3 id={labelId} className="pt-[3px] font-heading text-sm leading-[1.3] font-semibold">
        {label}
      </h3>
      {children && <div className="flex min-w-0 flex-wrap items-center gap-2">{children}</div>}
      {note && <div className="min-w-0 text-xs text-muted-foreground min-[421px]:col-start-2">{note}</div>}
    </div>
  );
}
