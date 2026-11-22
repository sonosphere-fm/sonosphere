import { readGitHistory } from "../server/changelog/history";

const entries = await readGitHistory();
await Bun.write(new URL("../server/changelog/history.json", import.meta.url), JSON.stringify(entries));
console.log(`Saved ${entries.length} changelog entries for the server.`);
