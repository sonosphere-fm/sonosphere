import { isUsernameFont, type UserAppearance } from "../../shared/username-fonts";
import { users } from "../db/schema";
import { sql } from "drizzle-orm";
import { eq } from "drizzle-orm";
import { db } from "../db/client";

export async function appearanceFor(id: number): Promise<UserAppearance> {
  const [row] = await db.select(appearanceCols).from(users).where(eq(users.id, id));
  return userAppearance(row ?? {});
}

export const appearanceCols = {
  cosmetics: sql<
    import("../../shared/cosmetics").EquippedCosmetic[]
  >`coalesce((select json_agg(json_build_object('slot', e.slot, 'id', e.cosmetic_id, 'options', e.options::json)) from user_equipped e join cosmetics c on c.id = e.cosmetic_id and c.enabled = true join user_cosmetics owned on owned.user_id = e.user_id and owned.cosmetic_id = e.cosmetic_id where e.user_id = "users"."id"), '[]'::json)`,
  showCosmetics: sql<boolean>`coalesce(${users.showCosmetics}, true)`,
  usernameFont: users.usernameFont,
  profileAccent: users.profileAccent,
  profileAccentEnd: users.profileAccentEnd,
};

export function userAppearance(u: {
  cosmetics?: import("../../shared/cosmetics").EquippedCosmetic[];
  showCosmetics?: boolean;
  usernameFont?: string | null;
  profileAccent?: string | null;
  profileAccentEnd?: string | null;
}): UserAppearance {
  return {
    cosmetics: u.cosmetics,
    showCosmetics: u.showCosmetics ?? true,
    usernameFont: isUsernameFont(u.usernameFont) ? u.usernameFont : "default",
    profileAccent: u.profileAccent ?? null,
    profileAccentEnd: u.profileAccentEnd ?? null,
  };
}
