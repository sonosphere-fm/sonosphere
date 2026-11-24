import { AdminPage } from "./shell";
export { ready } from "./i18n";

// scripts/build.ts looks for this text to find the staff-only bundles
export const STAFF_BUNDLE_MARK = "spin:staff-only-bundle";

export default function Admin() {
  return (
    <div data-bundle={STAFF_BUNDLE_MARK} style={{ display: "contents" }}>
      <AdminPage />
    </div>
  );
}
