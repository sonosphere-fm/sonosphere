// Run only against a disposable database: this script creates test users and changes their names.
if (!process.env.DATABASE_URL || !new URL(process.env.DATABASE_URL).pathname.startsWith("/username_verify")) {
  throw new Error("Set DATABASE_URL to a disposable database named username_verify...");
}
import { strict as assert } from "node:assert";
const { changeUsername, usernameStatus, usernameUnavailable, aliasUser } = await import("../server/account/usernames");
const { createUser, createSession } = await import("../server/auth/repo");
const { router } = await import("../server/account/routes");
const { db, pg } = await import("../server/db/client");
const { promote } = await import("../server/site/repo");
import { users, usernameHistory } from "../server/db/schema";
import { eq, sql } from "drizzle-orm";
import { now } from "../server/util";
import { USERNAME_COOLDOWN } from "../server/account/username-policy";

const id = await createUser("Original", "original@example.test", "", true);
const actor = { id, username: "Original" };
const changed = await changeUsername(id, actor, "Second");
assert.equal(changed.username, "Second");
assert(changed.usernameChangeAfter >= now() + USERNAME_COOLDOWN - 1);
assert.equal((await aliasUser("ORIGINAL"))?.id, id);
assert(await usernameUnavailable("Original"));
await assert.rejects(createUser("original", "blocked@example.test", "", true));
await assert.rejects(changeUsername(id, actor, "Third"));

const restored = await changeUsername(id, actor, undefined, true);
assert.equal(restored.username, "Original");
assert(restored.usernameChangeAfter >= now() + USERNAME_COOLDOWN - 1);
assert.equal((await aliasUser("Second"))?.id, id);
assert.equal((await usernameStatus(id)).undo, null);
await assert.rejects(changeUsername(id, actor, undefined, true));

await db.update(users).set({ usernameChangeAfter: now() }).where(eq(users.id, id));
await changeUsername(id, actor, "Third");
await db.update(users).set({ usernameChangeAfter: now() }).where(eq(users.id, id));
await changeUsername(id, actor, "Fourth");
assert.equal((await usernameStatus(id)).undo?.username, "Third");
assert.equal((await aliasUser("Original"))?.username, "Fourth");
await changeUsername(id, actor, undefined, true);
assert.equal((await aliasUser("Original"))?.username, "Third");

await db.update(usernameHistory).set({ reservedUntil: now() }).where(eq(usernameHistory.previousNorm, "original"));
assert.equal(await aliasUser("Original"), null);
assert.equal(await usernameUnavailable("original"), false);
const reclaimed = await createUser("Original", "reclaimed@example.test", "", true);
assert.notEqual(reclaimed, id);
await promote(["original"]);
const [reclaimedAccount] = await db.select().from(users).where(eq(users.id, reclaimed));
assert.equal(reclaimedAccount!.isAdmin, false);
assert((await db.select().from(usernameHistory).where(eq(usernameHistory.previousNorm, "original"))).length > 0);

const other = await createUser("Other", "other@example.test", "", true);
await db.update(users).set({ usernameChangeAfter: 0 }).where(eq(users.id, id));
const race = await Promise.allSettled([
  changeUsername(id, actor, "Contested"),
  changeUsername(other, { id: other, username: "Other" }, "contested"),
  createUser("CONTESTED", "race@example.test", "", true),
]);
assert.equal(race.filter((result) => result.status === "fulfilled").length, 1);
const renamedInRace = race.slice(0, 2).some((result) => result.status === "fulfilled");
assert.equal(
  (await db.execute(sql`SELECT count(*)::int AS n FROM audit_log WHERE action LIKE 'user.username.%'`))[0]!.n,
  5 + Number(renamedInRace)
);
const token = "abcdef1234567890";
await createSession(token, id);
assert.equal((await router.handle(new Request("http://localhost/api/me/username"))).status, 401);
const status = await router.handle(
  new Request("http://localhost/api/me/username", { headers: { Cookie: `sid=${token}` } })
);
assert.equal(status.status, 200);
assert.equal(typeof (await status.json()).changeAfter, "number");
const crossSite = await router.handle(
  new Request("http://localhost/api/me/username", {
    method: "POST",
    headers: { Cookie: `sid=${token}`, Origin: "https://other.test", "Content-Type": "application/json" },
    body: JSON.stringify({ username: "CrossSite" }),
  })
);
assert.equal(crossSite.status, 403);
const expiryId = await createUser("ExpiryBefore", "expiry@example.test", "", true);
await changeUsername(expiryId, { id: expiryId, username: "ExpiryBefore" }, "ExpiryAfter");
await db.update(usernameHistory).set({ reservedUntil: now() }).where(eq(usernameHistory.userId, expiryId));
await assert.rejects(changeUsername(expiryId, { id: expiryId, username: "ExpiryAfter" }, undefined, true));
console.log(
  "Verified cooldown, undo renewal, overlapping aliases, exact expiry, name reuse, retained history, audit, and concurrent claims."
);
await pg.end();
process.exit(0);
