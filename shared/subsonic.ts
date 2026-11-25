export type SubsonicStatus =
  | { connected: false }
  | {
      connected: true;
      url: string;
      username: string;
      name: string;
      version: string;
      openSubsonic: boolean;
    };

export type SubsonicConnectBody = { url: string; username: string; password: string };
