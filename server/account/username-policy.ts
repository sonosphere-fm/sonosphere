export const USERNAME = /^[a-zA-Z][a-zA-Z0-9_-]{1,14}$/;
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
