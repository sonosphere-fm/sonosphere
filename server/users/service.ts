// Account lookups for request handlers.
import { missing } from "../http";
import { findByName, type User } from "./repo";

/** The account with this username, or a 404. */
export const requireUser = async (name: string | null): Promise<User> => (await findByName(name || "")) ?? missing("User");

/** Whether `viewer` may see `target`'s recent listening: always, unless the owner hides it from everyone but themselves. */
export const canSee = (target: User, viewer: { id: number } | null): boolean => !target.hideRecent || viewer?.id === target.id;
