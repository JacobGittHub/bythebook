import { SettingsSpread } from "@/components/settings/SettingsSpread";
import { getViewer } from "@/lib/auth/viewer";
import { signOutAction } from "../actions";

/** Settings: appearance on the left page, your data and account on the right (plans/book-ui.md D10). */
export default async function SettingsPage() {
  const viewer = await getViewer();
  return <SettingsSpread displayName={viewer.signedIn ? viewer.displayName : null} signOut={signOutAction} />;
}
