import { parseGitHistory, readGitHistory } from "../server/changelog/history";

const input = process.env.CHANGELOG_GIT_LOG;
const entries = input ? parseGitHistory(await Bun.file(input).text()) : await readGitHistory();
if (!entries.length)
  throw new Error("Changelog history is empty; supply a Git log snapshot before building the image.");
await Bun.write(new URL("../server/changelog/history.json", import.meta.url), JSON.stringify(entries));
console.log(`Saved ${entries.length} changelog entries for the server.`);
