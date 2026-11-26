import { Router } from "../http";
import { staff } from "../guards";
import { paging } from "./common";
import * as repo from "./audit.repo";
import type { AuditList } from "../../shared/admin-content";

export const router = new Router({ jsonOnly: true });

router.get<AuditList>("/api/admin/audit", async (c) => {
  staff(c);
  const pg = paging(c.q, 50);
  const text = (name: string) => (c.q.get(name) || "").trim();
  const filter: repo.AuditFilter = {
    actor: text("actor"),
    action: text("action"),
    subject: text("user"),
    term: text("q"),
    automatic: c.q.get("automatic") === "1",
  };
  const { items, total } = await repo.entries(filter, pg);
  return {
    items,
    ...pg,
    total,
    actors: await repo.actors(),
    actions: await repo.actions(),
  };
});
