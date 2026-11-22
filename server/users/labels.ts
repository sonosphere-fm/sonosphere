import { asc, eq } from "drizzle-orm";
import { db } from "../db/client";
import { userLabels, userLabelAssignments, users } from "../db/schema";
import { adminOnly } from "../guards";
import { bad, missing, Router } from "../http";
import { audit } from "../site/audit";
import { LABEL_ICONS, type LabelDirectory, type UserLabel } from "../../shared/user-labels";

export const router = new Router({ jsonOnly: true });
async function directory(includeBanned = false): Promise<LabelDirectory> {
  const labels = await db.select().from(userLabels).orderBy(userLabels.id);
  const assignments = await db
    .select({ name: users.username, labelId: userLabelAssignments.labelId })
    .from(userLabelAssignments)
    .innerJoin(users, eq(users.id, userLabelAssignments.userId))
    .where(includeBanned ? undefined : eq(users.banned, false))
    .orderBy(asc(userLabelAssignments.position), userLabelAssignments.labelId);
  const directory: Record<string, number[]> = Object.create(null);
  for (const row of assignments) (directory[row.name.toLowerCase()] ??= []).push(row.labelId);
  return { labels: labels as UserLabel[], users: directory };
}
router.get<LabelDirectory>("/api/user-labels", () => directory());
router.get<LabelDirectory>("/api/admin/user-labels", (c) => {
  adminOnly(c);
  return directory(true);
});

function definition(body: Record<string, unknown>) {
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text || text.length > 40) bad("Tag text must be between 1 and 40 characters");
  if (!LABEL_ICONS.includes(body.icon as never)) bad("Choose a supported icon");
  if (typeof body.color !== "string" || !/^#[0-9a-f]{6}$/i.test(body.color)) bad("Choose a six-digit hex color");
  return { text, icon: body.icon as string, color: body.color as string };
}
router.post("/api/admin/user-labels", async (c) => {
  const actor = adminOnly(c);
  const value = definition(c.body);
  const [row] = await db.insert(userLabels).values(value).returning();
  await audit(actor, {
    action: "user-label.create",
    targetType: "user-label",
    targetId: row!.id,
    label: value.text,
    data: value,
  });
  return { ok: true };
});
router.patch("/api/admin/user-labels/:id", async (c) => {
  const actor = adminOnly(c);
  const value = definition(c.body);
  const [row] = await db
    .update(userLabels)
    .set(value)
    .where(eq(userLabels.id, Number(c.params[0]) || 0))
    .returning();
  if (!row) missing("Tag");
  await audit(actor, {
    action: "user-label.edit",
    targetType: "user-label",
    targetId: row.id,
    label: value.text,
    data: value,
  });
  return { ok: true };
});
router.delete("/api/admin/user-labels/:id", async (c) => {
  const actor = adminOnly(c);
  const [row] = await db
    .delete(userLabels)
    .where(eq(userLabels.id, Number(c.params[0]) || 0))
    .returning();
  if (!row) missing("Tag");
  await audit(actor, { action: "user-label.delete", targetType: "user-label", targetId: row.id, label: row.text });
  return { ok: true };
});
router.patch("/api/admin/users/:name/labels", async (c) => {
  const actor = adminOnly(c);
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.usernameNorm, (c.params[0] ?? "").toLowerCase()))
    .limit(1);
  if (!user) missing("User");
  const raw = c.body.ids;
  if (
    !Array.isArray(raw) ||
    raw.length > 20 ||
    raw.some((id) => !Number.isInteger(id) || id <= 0) ||
    new Set(raw).size !== raw.length
  )
    bad("Choose up to 20 distinct tags");
  const ids = raw as number[];
  await db.transaction(async (tx) => {
    const available = await tx.select().from(userLabels).for("share");
    if (ids.some((id) => !available.some((label) => label.id === id))) bad("One of those tags no longer exists");
    await tx.select({ id: users.id }).from(users).where(eq(users.id, user.id)).for("update");
    await tx.delete(userLabelAssignments).where(eq(userLabelAssignments.userId, user.id));
    if (ids.length)
      await tx
        .insert(userLabelAssignments)
        .values(ids.map((labelId, position) => ({ userId: user.id, labelId, position })));
  });
  await audit(actor, {
    action: "user.labels",
    targetType: "user",
    targetId: user.id,
    subjectId: user.id,
    label: user.username,
    data: { ids },
  });
  return { ok: true };
});
