"use client";

import Link from "next/link";
import { Download } from "lucide-react";
import { useBookFrame } from "@/components/book/BookFrame";
import { Spread, chapterFolio } from "@/components/book/Spread";
import { BugReportButton } from "@/components/layout/BugReportButton";
import { adviceText, useBackup } from "@/components/library/useBackup";
import { Button, buttonVariants } from "@/components/shadcn/button";
import { useLibrary, useLibraryBooks } from "@/context/Library";
import { useViewer } from "@/context/Viewer";
import { betaContactEmail, betaKeyMailto } from "@/lib/auth/contact";
import { AppearancePanel } from "./AppearancePanel";
import { SettingRow } from "./SettingRow";

const TITLE = "font-heading text-[30px] leading-[1.15] font-semibold tracking-[-0.01em]";
const LINK = "font-medium text-foreground underline";

/** About this deployment, moved from the Overview (plans/book-ui.md D10). */
const DEPLOYMENT_NOTES = [
  "ByTheBook is a solo project in beta, hosted on the free tiers of Vercel and Supabase. It may be slow to wake up after a quiet spell.",
  "Master-game statistics come from the Lichess masters database. They are saved on the server the first time anyone asks for a position, and every named opening is already saved.",
  "The engine is Stockfish running in your own browser, so its speed depends on your device.",
  "Accounts are limited to about 100 beta testers, and each needs a one-time beta key.",
];

/**
 * The developer's message to readers, shown under the deployment notes (D10). The user writes
 * it (plans/book-ui.md Phase 3); until then the page shows none.
 */
const DEVELOPER_MESSAGE: string | null = null;

/**
 * Settings as a spread (plans/book-ui.md D10, D13): appearance on the left page, with what this
 * deployment is and the thanks; your books, the account and, in debug mode, the bug report on
 * the right. `displayName` is the signed-in viewer's.
 */
export function SettingsSpread({
  displayName,
  signOut,
}: {
  displayName: string | null;
  signOut: () => Promise<void>;
}) {
  const { chapters, chapterCount, at } = useBookFrame();
  const { signedIn, debug } = useViewer();
  const { library, label } = useLibrary();
  const { books } = useLibraryBooks();
  const { advice, backingUp, backUp } = useBackup();
  const chapter = chapters[at];
  const folio = chapter && <span className="ml-auto">{chapterFolio(chapter.number, chapterCount)}</span>;
  const count = books === null ? null : `${books.length} ${books.length === 1 ? "book" : "books"}`;

  const left = (
    <div className="-mr-2.5 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-2.5">
      <h1 className={TITLE}>Appearance</h1>
      <AppearancePanel />
      <section aria-labelledby="about-label" className="flex flex-col gap-2 border-t border-rule pt-3.5">
        <h2 id="about-label" className="book-sc">
          About this book
        </h2>
        <ul className="list-disc space-y-1.5 pl-4 text-xs text-muted-foreground">
          {DEPLOYMENT_NOTES.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          Thank you to{" "}
          <a className={LINK} href="https://lichess.org" target="_blank" rel="noreferrer">
            Lichess
          </a>
          , whose free and open masters database gives the Explorer its statistics.
        </p>
        {DEVELOPER_MESSAGE && <p className="max-w-[60ch] text-sm leading-6">{DEVELOPER_MESSAGE}</p>}
      </section>
    </div>
  );

  const right = (
    <div className="-mr-2.5 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-2.5">
      <h2 className={TITLE}>Library and account</h2>
      <div className="flex flex-col">
        <SettingRow
          label="Your books"
          note={
            <>
              {label}
              {count && `, ${count}`}.{advice && ` ${adviceText(advice)}`}
            </>
          }
        >
          <Button size="sm" variant="outline" onClick={() => void backUp(library)} disabled={backingUp || !books?.length}>
            <Download /> {backingUp ? "Backing up…" : "Back up"}
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link href="/dashboard/library">Restore on the Library page</Link>
          </Button>
        </SettingRow>

        {signedIn ? (
          <SettingRow
            label="Account"
            note={
              <>
                Signed in as <span className="text-foreground">{displayName}</span>. Your books are saved to your
                account, on any device.
              </>
            }
          >
            <form action={signOut}>
              <Button type="submit" size="sm" variant="outline">
                Sign out
              </Button>
            </form>
          </SettingRow>
        ) : (
          <SettingRow
            label="Account"
            note={
              <>
                Browsing as a guest. An account keeps your books on any device, and needs a beta key.
                {betaKeyMailto && (
                  <>
                    {" "}
                    To ask for one, email{" "}
                    <a className={LINK} href={betaKeyMailto}>
                      {betaContactEmail}
                    </a>
                    .
                  </>
                )}
              </>
            }
          >
            <Button asChild size="sm">
              <Link href="/auth/login">Sign in</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/auth/register">Create account</Link>
            </Button>
          </SettingRow>
        )}

        {debug && (
          <SettingRow label="Problems" note="Copies what this page shows, for a bug report. The same button sits at the top right of every page in debug mode.">
            <BugReportButton signedIn={signedIn} icon className={buttonVariants({ size: "sm", variant: "outline" })} />
          </SettingRow>
        )}
      </div>
    </div>
  );

  return (
    <Spread
      left={{
        head: (
          <>
            <span>Settings</span>
            <span className="grow" />
            <span className="book-sc">Saved in this browser</span>
          </>
        ),
        body: left,
      }}
      right={{
        head: (
          <>
            <span className="book-sc">{signedIn ? "Signed in" : "Guest"}</span>
            <span className="grow" />
            <span>Your data</span>
          </>
        ),
        body: right,
        folio,
      }}
    />
  );
}
