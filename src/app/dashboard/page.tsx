import Link from "next/link";
import { OverviewShowcase } from "@/components/overview/OverviewShowcase";
import { Panel, PanelLabel } from "@/components/ui/Panel";
import { ACCESS_ROWS, visibleNavItems } from "@/lib/auth/access";
import { betaContactEmail, betaKeyMailto } from "@/lib/auth/contact";
import { getViewer } from "@/lib/auth/viewer";

const deploymentNotes = [
  "ByTheBook is a solo project in beta, hosted on the free tiers of Vercel and Supabase. It may be slow to wake up after a quiet spell.",
  "Master-game statistics come from the Lichess masters database. They are saved on the server the first time anyone asks for a position, and every named opening is already saved.",
  "The engine is Stockfish running in your own browser, so its speed depends on your device.",
  "Accounts are limited to about 100 beta testers, and each needs a one-time beta key.",
];

export default async function OverviewPage() {
  const viewer = await getViewer();
  // Every sidebar page with a description to show beside its demo, which leaves out this one.
  const pages = visibleNavItems(viewer.signedIn).filter((item) => item.details);

  return (
    <main className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">
          Learn openings as places, not move lists
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          ByTheBook is a chess opening trainer. Explore what masters play, see how openings
          sit next to each other, and build the books you want to remember.
          {viewer.signedIn
            ? ` You are signed in as ${viewer.displayName}.`
            : " You are browsing as a guest, with no account needed."}
        </p>
      </div>

      {/* Pages and their demos */}
      <section>
        <PanelLabel as="h2" className="mb-1.5">What you can do</PanelLabel>
        <OverviewShowcase items={pages} />
      </section>

      {/* Guest and account */}
      <section>
        <PanelLabel as="h2" className="mb-1.5">Guest and account</PanelLabel>
        {/* A phone is too narrow for three columns, so there each row is stacked. */}
        <Panel className="p-3 sm:hidden">
          <dl className="space-y-3 text-sm">
            {ACCESS_ROWS.map((row) => (
              <div key={row.feature}>
                <dt className="font-medium text-foreground">{row.feature}</dt>
                <dd className="mt-1 text-muted-foreground">
                  <span className="font-medium text-foreground">Guest:</span> {row.guest}
                </dd>
                <dd className="mt-0.5 text-muted-foreground">
                  <span className="font-medium text-foreground">Beta account:</span>{" "}
                  {row.account}
                </dd>
              </div>
            ))}
          </dl>
        </Panel>
        <Panel className="hidden px-3 py-2 sm:block">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-foreground">
                <th className="pb-2 pr-4 font-semibold" scope="col">
                  <span className="sr-only">Feature</span>
                </th>
                <th className="pb-2 pr-4 font-semibold" scope="col">
                  Guest
                </th>
                <th className="pb-2 font-semibold" scope="col">
                  Beta account
                </th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground">
              {ACCESS_ROWS.map((row) => (
                <tr key={row.feature} className="border-t border-border align-top">
                  <th
                    className="py-2 pr-4 font-medium text-foreground"
                    scope="row"
                  >
                    {row.feature}
                  </th>
                  <td className="py-2 pr-4">{row.guest}</td>
                  <td className="py-2">{row.account}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
        {!viewer.signedIn ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Have a beta key?{" "}
            <Link className="font-medium text-foreground underline" href="/auth/register">
              Create an account
            </Link>{" "}
            or{" "}
            <Link className="font-medium text-foreground underline" href="/auth/login">
              sign in
            </Link>
            .
            {betaKeyMailto ? (
              // The address is written out because a mailto link does nothing for a visitor
              // with no mail program set up; they can copy it instead.
              <>
                {" "}
                To ask for a key, email{" "}
                <a className="font-medium text-foreground underline" href={betaKeyMailto}>
                  {betaContactEmail}
                </a>
                .
              </>
            ) : null}
          </p>
        ) : null}
      </section>

      {/* Deployment */}
      <section>
        <PanelLabel as="h2" className="mb-1.5">About this deployment</PanelLabel>
        <Panel className="py-2 pl-7 pr-3">
          <ul className="list-disc space-y-1.5 text-sm text-muted-foreground">
            {deploymentNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </Panel>
      </section>
    </main>
  );
}
