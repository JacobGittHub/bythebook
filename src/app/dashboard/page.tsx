import Link from "next/link";
import { OverviewSpread } from "@/components/overview/OverviewSpread";
import { bookContents } from "@/lib/auth/access";
import { betaContactEmail, betaKeyMailto } from "@/lib/auth/contact";
import { getViewer } from "@/lib/auth/viewer";

/** The Overview: the book's contents, and the picked chapter (plans/book-ui.md D10). */
export default async function OverviewPage() {
  const viewer = await getViewer();
  return <OverviewSpread entries={bookContents(viewer.signedIn)} offer={viewer.signedIn ? null : <GuestOffer />} />;
}

/** For a guest, under what an account adds: how to get one. */
function GuestOffer() {
  const link = "font-bold text-foreground underline";
  return (
    <p className="text-xs text-muted-foreground">
      Have a beta key?{" "}
      <Link className={link} href="/auth/register">
        Create an account
      </Link>{" "}
      or{" "}
      <Link className={link} href="/auth/login">
        sign in
      </Link>
      .
      {betaKeyMailto ? (
        // The address is written out because a mailto link does nothing for a visitor with no
        // mail program set up; they can copy it instead.
        <>
          {" "}
          To ask for a key, email{" "}
          <a className={link} href={betaKeyMailto}>
            {betaContactEmail}
          </a>
          .
        </>
      ) : null}
    </p>
  );
}
