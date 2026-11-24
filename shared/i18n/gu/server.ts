import type en from "../en/server";
import type { Catalog } from "../core";

import errors from "./errors";
import mail from "./mail";
import playlists from "./playlists";

export default { errors, mail, playlists } satisfies Catalog<typeof en>;
