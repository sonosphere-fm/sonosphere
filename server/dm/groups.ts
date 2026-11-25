import { fail, HttpError } from "../http";
import { tr } from "../i18n";
import type { Locale } from "../../shared/i18n/core";
import { push } from "../realtime";
import { blockedAmong, blockedEither, findById, type User } from "../users/repo";
import { now } from "../util";
import { mailMessage } from "../notifications/email";
import {
  announceRemoved,
  canPost,
  checkUnsend,
  DM,
  dmCounts,
  dmLimits,
  gate,
  messageShape as directShape,
  opening,
  sentSinceTx,
  tidy,
} from "./service";
import { onProbation, PROBATION } from "../trust/service";
import * as repo from "./groups.repo";
import { checkReaction, reactionsOf, toggle } from "./reactions";
import { atomically, connection, followersAmong } from "./repo";
import type { Group, GroupMessage, Member } from "./groups.repo";
import type {
  DmDone,
  DmGroup,
  DmGroupCandidates,
  DmGroupMessage,
  DmGroupPage,
  DmGroupSent,
  DmReacted,
  DmReaction,
  DmUnsent,
  DmUser,
} from "../../shared/dm";

const GROUP = {
  MAX_MEMBERS: 10,
  TITLE_LENGTH: 80,
  NEW_PER_DAY: 10,
};

const notFound = (): never => fail(404, "conversationNotFound");

async function mine(id: unknown, userId: number): Promise<{ group: Group; member: Member }> {
  return (await repo.groupFor(Number(id) || 0, userId)) ?? notFound();
}

async function owned(id: unknown, me: User): Promise<Group> {
  const { group } = await mine(id, me.id);
  if (group.ownerId !== me.id) fail(403, "onlyGroupsOwnerDo");
  canPost(me);
  return group;
}

function cleanTitle(input: unknown): string {
  const title = tidy(input).replace(/\s+/g, " ");
  if (title.length > GROUP.TITLE_LENGTH) fail(400, "groupNameTooLong", { max: GROUP.TITLE_LENGTH });
  return title;
}

// Only people the adder already has an accepted conversation with, who could still be messaged directly,
// and who haven't blocked (or been blocked by) anyone already in the group.
async function checkAddable(me: User, target: User | null, others: number[]): Promise<User> {
  if (!target) return fail(404, "userNotFound");
  const refuse = () => fail(403, "cantAddUser", { username: target.username });
  try {
    await gate(me, target);
  } catch (e) {
    if (e instanceof HttpError) refuse();
    throw e;
  }
  if (!(await repo.hasActiveThread(me.id, target.id))) {
    fail(403, "onlyAddPeopleAlreadyConversation");
  }
  for (const id of others) {
    if (id !== target.id && (await blockedEither(id, target.id))) refuse();
  }
  return target;
}

const messageShape = (m: GroupMessage, reactions: DmReaction[] = []): DmGroupMessage => ({
  ...directShape(m, reactions),
  name: m.name,
  event: m.event,
});

async function shapeAll(groups: Group[], userId: number): Promise<DmGroup[]> {
  if (!groups.length) return [];
  const ids = groups.map((g) => g.id);
  const [members, lasts, unread] = await Promise.all([
    repo.membersOf(ids),
    repo.lastMessages(ids, userId),
    repo.unreadByGroup(ids, userId),
  ]);
  const lastById = new Map(lasts.map((m) => [m.groupId, m]));
  const blocked = await blockedAmong([userId], [...new Set(lasts.map((m) => m.senderId))]);
  return groups.map((group) => {
    const found = lastById.get(group.id);
    const last = found && (found.event || !blocked.has(found.senderId)) ? found : undefined;
    return {
      id: group.id,
      title: group.title,
      owner: group.ownerId,
      members: members.filter((m) => m.groupId === group.id).map(({ groupId: _, ...person }) => person),
      last: last ? messageShape(last) : null,
      at: group.lastAt,
      unread: unread.get(group.id) ?? 0,
    };
  });
}

const shapeFor = async (groupId: number, userId: number): Promise<DmGroup> => {
  const { group } = await mine(groupId, userId);
  return (await shapeAll([group], userId))[0]!;
};

// Blocks made after both joined still count: the pair stop hearing from each other in the group.
async function audience(groupId: number, userId: number): Promise<number[]> {
  const ids = await repo.memberIds(groupId);
  const blocked = await blockedAmong([userId], ids);
  return ids.filter((id) => !blocked.has(id));
}

// Sends the new line to everyone now in the group (or just `to`), and tells anyone who is no longer in it.
async function announce(
  groupId: number,
  messageId: number,
  gone: number[] = [],
  to?: number[]
): Promise<DmGroupMessage> {
  const message = messageShape(await repo.messageById(messageId));
  for (const uid of to ?? (await repo.memberIds(groupId))) {
    push(uid, { t: "dm-group", group: await shapeFor(groupId, uid), message, counts: await dmCounts(uid) });
  }
  for (const uid of gone) push(uid, { t: "dm-group-gone", groupId, counts: await dmCounts(uid) });
  return message;
}

async function announced(me: User, groupId: number, messageId: number, gone: number[] = []): Promise<DmGroupSent> {
  const message = await announce(groupId, messageId, gone);
  return { group: await shapeFor(groupId, me.id), message };
}

export async function list(me: User): Promise<DmGroup[]> {
  return shapeAll(
    (await repo.listGroups(me.id)).map((r) => r.group),
    me.id
  );
}

export async function candidates(me: User, groupId: unknown): Promise<DmGroupCandidates> {
  const inGroup = groupId ? await repo.memberIds((await mine(groupId, me.id)).group.id) : [];
  const contacts = (await repo.contacts(me.id)).filter((u) => !inGroup.includes(u.id));
  if (!contacts.length) return { users: [], size: GROUP.MAX_MEMBERS };
  const ids = contacts.map((u) => u.id);
  const [blocked, following] = await Promise.all([blockedAmong([me.id, ...inGroup], ids), followersAmong(ids, me.id)]);
  const addable = (u: (typeof contacts)[number]) => {
    try {
      opening(me, u, blocked.has(u.id), following.has(u.id));
      return true;
    } catch (e) {
      if (e instanceof HttpError) return false;
      throw e;
    }
  };
  const users = contacts.filter(addable).map(({ banned: _, dmPolicy: __, ...person }): DmUser => person);
  return { users, size: GROUP.MAX_MEMBERS };
}

export async function create(me: User, rawTitle: unknown, rawIds: unknown): Promise<DmGroupSent> {
  canPost(me);
  const title = cleanTitle(rawTitle);
  const ids = [...new Set(Array.isArray(rawIds) ? rawIds.map(Number) : [])].filter((id) => id !== me.id);
  if (ids.length < 2) fail(400, "pickLeastTwoPeopleGroup");
  if (ids.length + 1 > GROUP.MAX_MEMBERS) fail(400, "groupTooBig", { max: GROUP.MAX_MEMBERS });
  const people: User[] = [];
  for (const id of ids)
    people.push(
      await checkAddable(
        me,
        await findById(id),
        people.map((p) => p.id)
      )
    );
  const newGroups = (await onProbation(me)) ? PROBATION.NEW_GROUPS_PER_DAY : GROUP.NEW_PER_DAY;
  const { groupId, id } = await atomically(async (tx) => {
    const t = now();
    if (!me.isAdmin && (await repo.createdSinceTx(tx, me.id, t - 86400)) >= newGroups) {
      fail(429, "youveStartedLotGroupsToday");
    }
    const group = await repo.createTx(tx, me.id, title, t);
    for (const p of people) await repo.addMemberTx(tx, group.id, p.id, t, GROUP.MAX_MEMBERS);
    const names = people.map((p) => p.username).join(", ");
    const line = `${me.username} started the group with ${names}`;
    return { groupId: group.id, id: await repo.addMessageTx(tx, group.id, me.id, line, "created", t) };
  });
  return announced(me, groupId, id);
}

export async function page(locale: Locale, me: User, groupId: unknown, before: number): Promise<DmGroupPage> {
  const { group, member } = await mine(groupId, me.id);
  const rows = (await repo.messagesBetween(group.id, member.clearedId, before, 51)).reverse();
  const blocked = await blockedAmong([me.id], [...new Set(rows.map((m) => m.senderId))]);
  const shown = rows.slice(-50).filter((m) => m.event || !blocked.has(m.senderId));
  const reactions = await reactionsOf(
    "group",
    shown.map((m) => m.id)
  );
  let why = "";
  if (me.suspended) why = tr(locale, "errors.suspendedFromPostingNotice");
  else if (me.dmMuted) why = tr(locale, "errors.messagingOffNotice");
  return {
    group: (await shapeAll([group], me.id))[0]!,
    messages: shown.map((m) => messageShape(m, reactions.get(m.id))),
    more: rows.length > 50,
    can: !why,
    why,
    max: DM.MAX_LENGTH,
    unsendFor: DM.UNSEND_WINDOW,
    size: GROUP.MAX_MEMBERS,
  };
}

export async function send(me: User, groupId: unknown, rawBody: unknown): Promise<DmGroupSent> {
  const { group } = await mine(groupId, me.id);
  canPost(me);
  const body = tidy(rawBody);
  if (!body) fail(400, "writeMessageFirst");
  if (body.length > DM.MAX_LENGTH) fail(400, "messageTooLong", { max: DM.MAX_LENGTH });
  const lim = await dmLimits(me);
  const id = await atomically(async (tx) => {
    const t = now();
    if ((await sentSinceTx(tx, me.id, t - 60)) >= lim.perMinute) fail(429, "youreSendingMessagesTooQuickly");
    if ((await sentSinceTx(tx, me.id, t - 86400)) >= lim.perDay) fail(429, "youveReachedTodaysMessageLimit");
    return repo.addMessageTx(tx, group.id, me.id, body, null, t);
  });
  const to = await audience(group.id, me.id);
  const message = await announce(group.id, id, [], to);
  for (const uid of to) {
    const person = uid === me.id ? null : await findById(uid);
    if (person) await mailMessage(person, me.username, `g${group.id}`, false, body);
  }
  return { group: await shapeFor(group.id, me.id), message };
}

export async function read(me: User, groupId: unknown): Promise<DmDone> {
  const { group, member } = await mine(groupId, me.id);
  const top = await repo.topMessageId(group.id);
  if (top > member.readId) {
    await repo.markRead(group.id, me.id, top);
    push(me.id, { t: "dm-counts", counts: await dmCounts(me.id) });
  }
  return { ok: true, counts: await dmCounts(me.id) };
}

export async function rename(me: User, groupId: unknown, rawTitle: unknown): Promise<DmGroupSent> {
  const group = await owned(groupId, me);
  const title = cleanTitle(rawTitle);
  if (title === group.title) fail(400, "thatsAlreadyGroupsName");
  const line = title ? `${me.username} named the group "${title}"` : `${me.username} removed the group's name`;
  const id = await atomically(async (tx) => {
    await repo.updateTx(tx, group.id, { title });
    return repo.addMessageTx(tx, group.id, me.id, line, "title", now());
  });
  return announced(me, group.id, id);
}

export async function addMember(me: User, groupId: unknown, userId: unknown): Promise<DmGroupSent> {
  const group = await owned(groupId, me);
  const inGroup = await repo.memberIds(group.id);
  const target = await checkAddable(me, await findById(Number(userId) || 0), inGroup);
  if (inGroup.includes(target.id)) fail(400, "alreadyInGroup", { username: target.username });
  const id = await atomically(async (tx) => {
    const t = now();
    await repo.addMemberTx(tx, group.id, target.id, t, GROUP.MAX_MEMBERS);
    return repo.addMessageTx(tx, group.id, me.id, `${me.username} added ${target.username}`, "added", t);
  });
  return announced(me, group.id, id);
}

async function memberOf(groupId: number, userId: unknown): Promise<User> {
  const target = await findById(Number(userId) || 0);
  if (!target || !(await repo.groupFor(groupId, target.id))) return fail(404, "personIsntGroup");
  return target;
}

export async function removeMember(me: User, groupId: unknown, userId: unknown): Promise<DmGroupSent> {
  const group = await owned(groupId, me);
  const target = await memberOf(group.id, userId);
  if (target.id === me.id) fail(400, "leaveGroupInstead");
  const id = await atomically(async (tx) => {
    await repo.removeMemberTx(tx, group.id, target.id);
    return repo.addMessageTx(tx, group.id, me.id, `${me.username} removed ${target.username}`, "removed", now());
  });
  return announced(me, group.id, id, [target.id]);
}

export async function makeOwner(me: User, groupId: unknown, userId: unknown): Promise<DmGroupSent> {
  const group = await owned(groupId, me);
  const target = await memberOf(group.id, userId);
  if (target.id === me.id) fail(400, "youreAlreadyOwner");
  const id = await atomically(async (tx) => {
    await repo.updateTx(tx, group.id, { ownerId: target.id });
    return repo.addMessageTx(tx, group.id, me.id, `${me.username} made ${target.username} the owner`, "owner", now());
  });
  return announced(me, group.id, id);
}

// An owner who leaves hands the group to whoever has been in it longest; the last person out deletes it.
export async function leave(me: User, groupId: unknown): Promise<DmDone> {
  const { group } = await mine(groupId, me.id);
  const id = await atomically(async (tx) => {
    await repo.removeMemberTx(tx, group.id, me.id);
    const next = await repo.longestMemberTx(tx, group.id);
    if (next === null) {
      await repo.dropTx(tx, group.id);
      return null;
    }
    let line = `${me.username} left the group`;
    if (group.ownerId === me.id) {
      await repo.updateTx(tx, group.id, { ownerId: next.id });
      line += `, so ${next.username} is now the owner`;
    }
    return repo.addMessageTx(tx, group.id, me.id, line, "left", now());
  });
  if (id === null) push(me.id, { t: "dm-group-gone", groupId: group.id, counts: await dmCounts(me.id) });
  else await announce(group.id, id, [me.id]);
  return { ok: true, counts: await dmCounts(me.id) };
}

export async function unsend(me: User, messageId: unknown): Promise<DmUnsent> {
  const m = (await repo.ownMessage(Number(messageId) || 0, me.id)) ?? fail(404, "messageNotFound");
  await mine(m.groupId, me.id);
  checkUnsend(m);
  await announceRemoved([await repo.softDeleteTx(connection, m.id, me.id, now())]);
  return { ok: true };
}

export async function react(me: User, messageId: unknown, emoji: unknown): Promise<DmReacted> {
  const m = (await repo.findMessage(Number(messageId) || 0)) ?? fail(404, "messageNotFound");
  const { member } = await mine(m.groupId, me.id);
  if (m.id <= member.clearedId) fail(404, "messageNotFound");
  canPost(me);
  if (m.deletedAt) fail(403, "cantReactMessage");
  const reactions = await toggle("group", m.id, me.id, await checkReaction(me.id, emoji));
  for (const uid of await audience(m.groupId, me.id)) {
    push(uid, { t: "dm-group-react", groupId: m.groupId, id: m.id, reactions });
  }
  return { reactions };
}

export async function relayGroupTyping(userId: number, groupId: number): Promise<void> {
  const found = await repo.groupFor(groupId, userId);
  const me = await findById(userId);
  if (!found || !me) return;
  for (const uid of await audience(groupId, userId)) {
    if (uid !== userId) push(uid, { t: "dm-group-typing", groupId, name: me.username });
  }
}
