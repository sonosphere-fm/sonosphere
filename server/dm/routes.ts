import { confirmed, need } from "../guards";
import { ipOf, Router } from "../http";
import { onClientMessage } from "../realtime";
import { checkTurnstile } from "../auth/turnstile";
import { requireUser } from "../users/service";
import * as dm from "./service";
import * as groups from "./groups";
import type {
  DmAccepted,
  DmDone,
  DmGroupCandidates,
  DmGroupPage,
  DmGroupSent,
  DmList,
  DmReacted,
  DmSent,
  DmThreadPage,
  DmUnsent,
  DmWith,
} from "../../shared/dm";

export const router = new Router();

const before = (c: { q: URLSearchParams }) => Number(c.q.get("before")) || 2 ** 31 - 1;

router.get<DmList>("/api/dm", async (c) => {
  const me = need(c);
  const box = c.q.get("box") === "requests" ? "requests" : "inbox";
  return { ...(await dm.list(me, box)), groups: box === "inbox" ? await groups.list(me) : [] };
});

router.get<DmWith>("/api/dm/with", async (c) => {
  const me = need(c);
  return dm.withUser(me, await requireUser(c.q.get("name")));
});

router.get<DmThreadPage>("/api/dm/thread/:id", (c) => dm.page(need(c), c.params[0], before(c)));

router.post<DmSent>("/api/dm/send", async (c) => {
  const me = confirmed(need(c));
  if (c.body.thread != null) return dm.sendToThread(me, c.body.thread, c.body.body);
  const to = await requireUser(String(c.body.to ?? ""));
  if (await dm.firstContact(me, to)) await checkTurnstile(c.body.turnstile, ipOf(c.req), "dm");
  return dm.send(me, to, c.body.body);
});

router.post<DmDone>("/api/dm/thread/:id/read", (c) => dm.read(need(c), c.params[0]));
router.post<DmAccepted>("/api/dm/thread/:id/accept", (c) => dm.accept(need(c), c.params[0]));
router.post<DmDone>("/api/dm/thread/:id/decline", (c) => dm.decline(need(c), c.params[0]));
router.delete<DmDone>("/api/dm/thread/:id", (c) => dm.clear(need(c), c.params[0]));
router.delete<DmUnsent>("/api/dm/message/:id", (c) => dm.unsend(need(c), c.params[0]));
router.post<DmReacted>("/api/dm/message/:id/react", (c) => dm.react(need(c), c.params[0], c.body.emoji));

router.get<DmGroupCandidates>("/api/dm/group/candidates", (c) => groups.candidates(need(c), c.q.get("group")));
router.post<DmGroupSent>("/api/dm/group", (c) => groups.create(confirmed(need(c)), c.body.title, c.body.users));
router.get<DmGroupPage>("/api/dm/group/:id", (c) => groups.page(need(c), c.params[0], before(c)));
router.post<DmGroupSent>("/api/dm/group/:id/send", (c) => groups.send(confirmed(need(c)), c.params[0], c.body.body));
router.post<DmDone>("/api/dm/group/:id/read", (c) => groups.read(need(c), c.params[0]));
router.post<DmGroupSent>("/api/dm/group/:id/title", (c) => groups.rename(need(c), c.params[0], c.body.title));
router.post<DmGroupSent>("/api/dm/group/:id/members", (c) =>
  groups.addMember(confirmed(need(c)), c.params[0], c.body.user)
);
router.delete<DmGroupSent>("/api/dm/group/:id/members/:user", (c) =>
  groups.removeMember(need(c), c.params[0], c.params[1])
);
router.post<DmGroupSent>("/api/dm/group/:id/owner", (c) => groups.makeOwner(need(c), c.params[0], c.body.user));
router.post<DmDone>("/api/dm/group/:id/leave", (c) => groups.leave(need(c), c.params[0]));
router.delete<DmUnsent>("/api/dm/group/message/:id", (c) => groups.unsend(need(c), c.params[0]));
router.post<DmReacted>("/api/dm/group/message/:id/react", (c) => groups.react(need(c), c.params[0], c.body.emoji));

export function startDm(): void {
  onClientMessage((userId, msg) => {
    if (msg.t !== "typing") return;
    const relay = msg.group
      ? groups.relayGroupTyping(userId, Number(msg.group) || 0)
      : dm.relayTyping(userId, Number(msg.thread) || 0);
    relay.catch((e) => console.error(e));
  });
}
