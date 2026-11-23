import { and, eq } from "drizzle-orm";
import { COSMETICS, COSMETIC_SLOTS, type CosmeticsState } from "../../shared/cosmetics";
import { db, transact } from "../db/client";
import { cosmetics, userCosmetics, userEquipped, users } from "../db/schema";
import { auditTx } from "../site/audit";
import { adminOnly, need } from "../guards";
import { bad, missing, Router } from "../http";
import { now } from "../util";
import { findByName } from "../users/repo";

export const router = new Router();
async function state(id: number): Promise<CosmeticsState> {
  const [owned, equipped, [user]] = await Promise.all([
    db.select().from(userCosmetics).where(eq(userCosmetics.userId, id)),
    db.select().from(userEquipped).where(eq(userEquipped.userId, id)),
    db.select({ show: users.showCosmetics }).from(users).where(eq(users.id, id)),
  ]);
  return {
    owned: COSMETICS.filter((c) => owned.some((o) => o.cosmeticId === c.id)),
    equipped: equipped.map((e) => ({
      slot: e.slot as CosmeticsState["equipped"][number]["slot"],
      id: e.cosmeticId,
      options: JSON.parse(e.options),
    })),
    showCosmetics: user?.show ?? true,
  };
}
router.get<CosmeticsState>("/api/me/cosmetics", (c) => state(need(c).id));
router.patch<CosmeticsState>("/api/me/cosmetics", async (c) => {
  const u = need(c);
  if (c.body.showCosmetics !== undefined) {
    if (typeof c.body.showCosmetics !== "boolean") return bad("Choose whether to show animations");
    await db.update(users).set({ showCosmetics: c.body.showCosmetics }).where(eq(users.id, u.id));
  } else {
    const slot = String(c.body.slot);
    if (!COSMETIC_SLOTS.some((value) => value === slot)) return bad("Choose a cosmetic slot");
    await transact(async (tx) => {
      // Serialize grants, revokes and equipment for this user.
      await tx.select({ id: users.id }).from(users).where(eq(users.id, u.id)).for("update");
      if (c.body.id === null) {
        await tx.delete(userEquipped).where(and(eq(userEquipped.userId, u.id), eq(userEquipped.slot, slot)));
        return;
      }
      const item = COSMETICS.find((x) => x.id === c.body.id && x.slot === slot) ?? bad("Choose a cosmetic");
      const [catalogItem] = await tx.select().from(cosmetics).where(eq(cosmetics.id, item.id));
      if (!catalogItem?.enabled) return bad("This cosmetic is unavailable");
      const [own] = await tx
        .select()
        .from(userCosmetics)
        .where(and(eq(userCosmetics.userId, u.id), eq(userCosmetics.cosmeticId, item.id)));
      if (!own) return bad("Ask an admin for this cosmetic first");
      const color = c.body.color;
      if (item.colors.length && (typeof color !== "string" || !item.colors.includes(color)))
        return bad("Choose an allowed color");
      const value = {
        userId: u.id,
        slot,
        cosmeticId: item.id,
        options: JSON.stringify(item.colors.length ? { color } : {}),
      };
      await tx
        .insert(userEquipped)
        .values(value)
        .onConflictDoUpdate({ target: [userEquipped.userId, userEquipped.slot], set: value });
    });
  }
  return state(u.id);
});
router.get("/api/admin/cosmetics", async (c) => {
  adminOnly(c);
  const name = c.q.get("name");
  const user = name ? ((await findByName(name)) ?? missing("User")) : null;
  return {
    catalog: COSMETICS,
    user: user ? { id: user.id, username: user.username } : null,
    state: user ? await state(user.id) : null,
  };
});
router.post("/api/admin/cosmetics", async (c) => {
  const admin = adminOnly(c);
  const names = Array.isArray(c.body.users) ? c.body.users : [];
  const ids = Array.isArray(c.body.ids) ? c.body.ids : [];
  if (!names.length || names.length > 50 || !ids.length || ids.length > 38)
    return bad("Choose up to 50 users and 38 cosmetics");
  if (!names.every((name) => typeof name === "string" && name.length <= 100)) return bad("Invalid usernames");
  if (c.body.note !== undefined && (typeof c.body.note !== "string" || c.body.note.length > 500))
    return bad("Notes must be at most 500 characters");
  if (!ids.every((id) => COSMETICS.some((x) => x.id === id))) return bad("Unknown cosmetic");
  const action = c.body.action;
  if (action !== "grant" && action !== "revoke") return bad("Choose grant or revoke");
  const targets = await Promise.all(
    [...new Set(names)].map(async (name) => (await findByName(String(name))) ?? missing("User"))
  );
  const note = String(c.body.note ?? "")
    .trim()
    .slice(0, 500);
  await transact(async (tx) => {
    await tx
      .insert(cosmetics)
      .values(COSMETICS.map((x) => ({ ...x, variants: JSON.stringify(x.colors) })))
      .onConflictDoNothing();
    for (const user of targets.sort((a, b) => a.id - b.id)) {
      await tx.select({ id: users.id }).from(users).where(eq(users.id, user.id)).for("update");
      for (const id of [...new Set(ids)] as string[]) {
        if (action === "grant")
          await tx
            .insert(userCosmetics)
            .values({ userId: user.id, cosmeticId: id, grantedAt: now(), grantedBy: c.actor?.id ?? admin.id, note })
            .onConflictDoNothing();
        else {
          await tx.delete(userEquipped).where(and(eq(userEquipped.userId, user.id), eq(userEquipped.cosmeticId, id)));
          await tx
            .delete(userCosmetics)
            .where(and(eq(userCosmetics.userId, user.id), eq(userCosmetics.cosmeticId, id)));
        }
        await auditTx(tx, c.actor ?? admin, {
          action: `cosmetics.${action}`,
          targetType: "user",
          targetId: user.id,
          subjectId: user.id,
          label: user.username,
          note,
          data: { cosmeticId: id },
        });
      }
    }
  });
  return { ok: true };
});
