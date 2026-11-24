import type en from "../en/catalog-admin";
import type { Catalog } from "../core";

import admin from "./admin";

export default { admin } satisfies Catalog<typeof en>;
