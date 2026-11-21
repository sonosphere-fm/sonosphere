import { missing } from "../http";
import { findByName, type User } from "./repo";

export const requireUser = async (name: string | null): Promise<User> =>
  (await findByName(name || "")) ?? missing("User");

type Who = { id: number } | null;
export const canSee = (target: User, viewer: Who): boolean =>
  (!target.hideRecent && !target.privateListening) || viewer?.id === target.id;
export const canSeeCharts = (target: User, viewer: Who): boolean => !target.privateListening || viewer?.id === target.id;
