// HTTP routes for direct messages. Every one needs a signed-in user; the rules live in ./service.
import { need } from "../guards";
import { Router } from "../http";
import { requireUser } from "../users/service";
import * as dm from "./service";
import type { DmAccepted, DmDone, DmList, DmSent, DmThreadPage, DmUnsent, DmWith } from "../../shared/dm";

export const router = new Router();

router.get<DmList>("/api/dm", c => dm.list(need(c), c.q.get("box") === "requests" ? "requests" : "inbox"));

router.get<DmWith>("/api/dm/with", async c => { const me = need(c); return dm.withUser(me, await requireUser(c.q.get("name"))); });

router.get<DmThreadPage>("/api/dm/thread/:id", c => dm.page(need(c), c.params[0], Number(c.q.get("before")) || Number.MAX_SAFE_INTEGER));

/** Into an existing conversation (`thread`) or to a username (`to`), which may start one. */
router.post<DmSent>("/api/dm/send", async c => {
  const me = need(c);
  if (c.body.thread != null) return dm.sendToThread(me, c.body.thread, c.body.body);
  return dm.send(me, await requireUser(String(c.body.to ?? "")), c.body.body);
});

router.post<DmDone>("/api/dm/thread/:id/read", c => dm.read(need(c), c.params[0]));
router.post<DmAccepted>("/api/dm/thread/:id/accept", c => dm.accept(need(c), c.params[0]));
router.post<DmDone>("/api/dm/thread/:id/decline", c => dm.decline(need(c), c.params[0]));
router.delete<DmDone>("/api/dm/thread/:id", c => dm.clear(need(c), c.params[0]));
router.delete<DmUnsent>("/api/dm/message/:id", c => dm.unsend(need(c), c.params[0]));
