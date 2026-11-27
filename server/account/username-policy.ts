import { bad } from "../http";

const USERNAME = /^[a-zA-Z][a-zA-Z0-9_-]{0,14}$/;

export const fitsUsername = (name: string, shortest = 3) => USERNAME.test(name) && name.length >= shortest;

export function checkUsername(name: unknown, shortest = 3): asserts name is string {
  if (typeof name !== "string" || !fitsUsername(name, shortest)) bad("invalidUsername", { min: shortest });
}
export const USERNAME_COOLDOWN = 7 * 86400;
export const USERNAME_RESERVATION = 14 * 86400;

export function canUndoUsername(
  change: { isUndo: boolean; undoneAt: number | null; releasedAt: number | null; reservedUntil: number } | null,
  at: number
) {
  return (
    !!change && !change.isUndo && change.undoneAt === null && change.releasedAt === null && change.reservedUntil > at
  );
}
