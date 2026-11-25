import type { Session } from "./auth";

export type LoginResult = Session | { twoFactor: true };
export type TotpStatus = { enabled: boolean; recoveryRemaining: number };
export type TotpSetup = { secret: string; uri: string; ticket: string };
export type TotpRecovery = { codes: string[] };
