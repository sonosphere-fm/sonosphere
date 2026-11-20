// Entry point of the staff portal. It is loaded on demand and built into its own files, which the server
// only hands to signed-in staff (see server/app.ts), so nobody else can download the admin screens.
import { AdminPage } from "./shell";

/** Marks the built files that contain staff-only code. The build looks for this text; do not change one without the other. */
export const STAFF_BUNDLE_MARK = "spin:staff-only-bundle";

export default function Admin() {
  // The development server injects the portal's styles itself; the built site keeps them behind the staff check.
  const styles = process.env.NODE_ENV === "production" ? <link rel="stylesheet" href="/assets/staff.css" precedence="default" /> : null;
  return <div data-bundle={STAFF_BUNDLE_MARK} style={{ display: "contents" }}>{styles}<AdminPage /></div>;
}
