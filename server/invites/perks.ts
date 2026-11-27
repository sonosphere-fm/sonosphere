import { and, eq, isNull } from "drizzle-orm";
import { transact } from "../db/client";
import { userCosmetics, userEquipped } from "../db/schema";
import { seedCatalog } from "../cosmetics/catalog";
import { now } from "../util";
import { inviteCounts } from "./repo";
import { INVITE_TIERS, tierFor } from "../../shared/invites";

// Marks grants this sync owns, so it never touches cosmetics staff handed out.
const NOTE = "invite tier";

export async function syncInviteCosmetics() {
  const counts = await inviteCounts();
  const want = [...counts].flatMap(([userId, invited]) =>
    INVITE_TIERS.slice(0, tierFor(invited) + 1).flatMap((tier) =>
      tier.cosmetics.map((cosmeticId) => ({ userId, cosmeticId }))
    )
  );
  const key = (r: { userId: number; cosmeticId: string }) => `${r.userId}:${r.cosmeticId}`;
  const wanted = new Set(want.map(key));
  await transact(async (tx) => {
    await seedCatalog(tx);
    if (want.length)
      await tx
        .insert(userCosmetics)
        .values(want.map((r) => ({ ...r, grantedAt: now(), note: NOTE })))
        .onConflictDoNothing();
    const held = await tx
      .select({ userId: userCosmetics.userId, cosmeticId: userCosmetics.cosmeticId })
      .from(userCosmetics)
      .where(and(isNull(userCosmetics.grantedBy), eq(userCosmetics.note, NOTE)));
    for (const r of held.filter((r) => !wanted.has(key(r)))) {
      await tx
        .delete(userEquipped)
        .where(and(eq(userEquipped.userId, r.userId), eq(userEquipped.cosmeticId, r.cosmeticId)));
      await tx
        .delete(userCosmetics)
        .where(and(eq(userCosmetics.userId, r.userId), eq(userCosmetics.cosmeticId, r.cosmeticId)));
    }
  });
}
