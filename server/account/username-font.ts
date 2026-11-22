import { Router } from "../http";
import { findByName } from "../users/repo";
import { userAppearance } from "../users/appearance";
import type { UserAppearance } from "../../shared/username-fonts";

export const router = new Router();

// Name-only references (wiki history, playlist owners) don't carry a full user payload.
router.get<UserAppearance>("/api/user/appearance", async (c) => {
  const u = await findByName(c.q.get("name") ?? "");
  return u && !u.banned ? userAppearance(u) : {};
});
