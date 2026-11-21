import { now } from "../util";
import type { Conn } from "../db/client";
import { insertAudit, insertAuditTx } from "./repo";

// `subjectId` is the account the action concerns, so a person's history can be listed.
export type AuditEntry = {
  action: string;
  targetType?: string;
  targetId?: number | null;
  label?: string;
  subjectId?: number | null;
  note?: string;
  data?: object;
};

type Actor = { id: number; username: string };

const row = (actor: Actor, e: AuditEntry) => ({
  actorId: actor.id,
  actorName: actor.username,
  action: e.action,
  targetType: e.targetType ?? "",
  targetId: e.targetId ?? null,
  targetLabel: (e.label ?? "").slice(0, 300),
  subjectId: e.subjectId ?? null,
  note: (e.note ?? "").trim().slice(0, 1000),
  data: JSON.stringify(e.data ?? {}),
  createdAt: now(),
});

export const audit = (actor: Actor, e: AuditEntry): Promise<void> => insertAudit(row(actor, e));
export const auditTx = (conn: Conn, actor: Actor, e: AuditEntry): Promise<void> => insertAuditTx(conn, row(actor, e));
