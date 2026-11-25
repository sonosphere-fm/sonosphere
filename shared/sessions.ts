export type ActiveSession = {
  id: string;
  userAgent: string;
  ip: string;
  createdAt: number;
  lastSeenAt: number;
  current: boolean;
};
export type ActiveSessions = { items: ActiveSession[] };
