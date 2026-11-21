import { AdminPage } from "./shell";

// scripts/build.ts looks for this text to find the staff-only bundles
export const STAFF_BUNDLE_MARK = "spin:staff-only-bundle";

export default function Admin() {
  // in development the dev server injects these styles itself
  const styles = process.env.NODE_ENV === "production"
    ? <link rel="stylesheet" href="/assets/staff.css" precedence="default" />
    : null;
  return (
    <div data-bundle={STAFF_BUNDLE_MARK} style={{ display: "contents" }}>
      {styles}
      <AdminPage />
    </div>
  );
}
