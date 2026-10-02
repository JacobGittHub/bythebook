import Link from "next/link";
import { OverviewShowcase } from "@/components/overview/OverviewShowcase";
import { ACCESS_ROWS, visibleNavItems } from "@/lib/auth/access";
import { betaContactEmail, betaKeyMailto } from "@/lib/auth/contact";
import { getViewer } from "@/lib/auth/viewer";

const sectionHeadingClass =
  "mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]";
const cardClass = "rounded-3xl border border-[var(--border-card)] bg-[var(--bg-muted)] p-5";

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
    <main className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-[var(--text-primary)]">
          Learn openings as places, not move lists
        </h1>
        <p className="mt-2 max-w-3xl text-[var(--text-muted)]">
          ByTheBook is a chess opening trainer. Explore what masters play, see how openings
          sit next to each other, and build the books you want to remember.
          {viewer.signedIn
            ? ` You are signed in as ${viewer.displayName}.`
            : " You are browsing as a guest, with no account needed."}
        </p>
      </div>

      {/* Pages and their demos */}
      <section>
        <h2 className={sectionHeadingClass}>What you can do</h2>
        <OverviewShowcase items={pages} />
      </section>

      {/* Guest and account */}
      <section>
        <h2 className={sectionHeadingClass}>Guest and account</h2>
        <div className={`${cardClass} overflow-x-auto`}>
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead>
              <tr className="text-[var(--text-primary)]">
                <th className="pb-3 pr-4 font-semibold" scope="col">
                  <span className="sr-only">Feature</span>
                </th>
                <th className="pb-3 pr-4 font-semibold" scope="col">
                  Guest
                </th>
                <th className="pb-3 font-semibold" scope="col">
                  Beta account
                </th>
              </tr>
            </thead>
            <tbody className="text-[var(--text-muted)]">
              {ACCESS_ROWS.map((row) => (
                <tr key={row.feature} className="border-t border-[var(--border-card)] align-top">
                  <th
                    className="py-3 pr-4 font-medium text-[var(--text-primary)]"
                    scope="row"
                  >
                    {row.feature}
                  </th>
                  <td className="py-3 pr-4">{row.guest}</td>
                  <td className="py-3">{row.account}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!viewer.signedIn ? (
          <p className="mt-4 text-sm text-[var(--text-muted)]">
            Have a beta key?{" "}
            <Link className="font-medium text-[var(--text-primary)] underline" href="/auth/register">
              Create an account
            </Link>{" "}
            or{" "}
            <Link className="font-medium text-[var(--text-primary)] underline" href="/auth/login">
              sign in
            </Link>
            .
            {betaKeyMailto ? (
              // The address is written out because a mailto link does nothing for a visitor
              // with no mail program set up; they can copy it instead.
              <>
                {" "}
                To ask for a key, email{" "}
                <a className="font-medium text-[var(--text-primary)] underline" href={betaKeyMailto}>
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
        <h2 className={sectionHeadingClass}>About this deployment</h2>
        <ul className={`${cardClass} list-disc space-y-2 pl-9 text-sm text-[var(--text-muted)]`}>
          {deploymentNotes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
