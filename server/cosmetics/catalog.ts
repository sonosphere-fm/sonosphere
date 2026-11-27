import { COSMETICS } from "../../shared/cosmetics";
import type { Tx } from "../db/client";
import { cosmetics } from "../db/schema";

export const seedCatalog = (tx: Tx) =>
  tx
    .insert(cosmetics)
    .values(COSMETICS.map((x) => ({ ...x, variants: JSON.stringify(x.colors) })))
    .onConflictDoNothing();
