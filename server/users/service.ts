// Account lookups for request handlers.
import { missing } from "../http";
import { findByName, type User } from "./repo";

/** The account with this username, or a 404. */
export const requireUser = async (name: string | null): Promise<User> => (await findByName(name || "")) ?? missing("User");

type Who = { id: number } | null;
/** Whether `viewer` may see `target`'s recent listening: always, unless the owner hides it from everyone but themselves. */
export const canSee = (target: User, viewer: Who): boolean => (!target.hideRecent && !target.privateListening) || viewer?.id === target.id;
/**
 * Whether `viewer` may see what `target` listens to at all: charts, library, loved tracks, play counts, reports and
 * soundalikes. Private listeners still count toward site-wide totals, without their name on them.
 */
export const canSeeCharts = (target: User, viewer: Who): boolean => !target.privateListening || viewer?.id === target.id;
