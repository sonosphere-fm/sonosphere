import type en from "../en/index";
import type { Catalog } from "../core";

import common from "./common";
import settings from "./settings";
import auth from "./auth";
import messages from "./messages";
import events from "./events";
import player from "./player";
import user from "./user";
import music from "./music";
import dev from "./dev";
import playlists from "./playlists";

export default { common, settings, auth, messages, events, player, user, music, dev, playlists } satisfies Catalog<
  typeof en
>;
