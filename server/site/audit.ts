// The audit log: a permanent record of what staff did, to what, and why.
import { now } from "../util";
import type { Conn } from "../db/client";
import { insertAudit, insertAuditTx } from "./repo";

/** One staff action. `subjectId` is the account it concerns, so a person's history can be listed. */
export type AuditEntry = { action: string; targetType?: string; targetId?: number | null; label?: string; subjectId?: number | null; note?: string; data?: object };

type Actor = { id: number; username: string };
const row = (actor: Actor, e: AuditEntry) => ({
  actorId: actor.id, actorName: actor.username, action: e.action, targetType: e.targetType ?? "", targetId: e.targetId ?? null,
  targetLabel: (e.label ?? "").slice(0, 300), subjectId: e.subjectId ?? null, note: String(e.note ?? "").trim().slice(0, 1000),
  data: JSON.stringify(e.data ?? {}), createdAt: now(),
});

export const audit = (actor: Actor, e: AuditEntry): Promise<void> => insertAudit(row(actor, e));
/** As audit, inside a transaction, so the record and the action stand or fall together. */
export const auditTx = (conn: Conn, actor: Actor, e: AuditEntry): void => insertAuditTx(conn, row(actor, e));
