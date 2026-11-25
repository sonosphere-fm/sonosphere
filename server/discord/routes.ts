import { need } from "../guards";
import { limit, Router } from "../http";
import * as discord from "./service";
import type { DiscordStatus } from "../../shared/discord";

export const router = new Router();

router.get<DiscordStatus>("/api/discord", (c) => discord.status(need(c).id));

router.post<DiscordStatus>("/api/discord", async (c) => {
  const u = need(c);
  await limit(`discord-toggle:${u.id}`, 30, 3600, "tooManyRequests");
  return discord.toggle(u.id, c.body.on === true);
});
