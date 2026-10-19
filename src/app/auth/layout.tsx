import { Panel } from "@/components/ui/Panel";

/** The sign-in, account and reset pages: one panel on the walnut desk (plans/book-ui.md D20), outside the dashboard. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative isolate min-h-dvh">
      <div
        data-slot="backdrop"
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10 [background:var(--desk-paint)]"
      />
      <main className="mx-auto flex min-h-dvh max-w-md items-center px-4 py-10">
        <Panel as="section" className="w-full p-5">
          {children}
        </Panel>
      </main>
    </div>
  );
}
