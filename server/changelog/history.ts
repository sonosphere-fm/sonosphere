import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ChangelogEntry } from "../../shared/changelog";

const exec = promisify(execFile);
const root = new URL("../../", import.meta.url);

export async function readGitHistory(): Promise<ChangelogEntry[]> {
  const { stdout } = await exec(
    "git",
    [
      "log",
      "-30",
      "--first-parent",
      "--diff-merges=first-parent",
      "--numstat",
      "--format=%x00%H%x00%cI%x00%an%x00%s%x00",
      "HEAD",
      "--",
    ],
    { cwd: root, timeout: 10000, maxBuffer: 16 * 1024 * 1024 }
  );
  const fields = stdout.split("\0");
  const entries: ChangelogEntry[] = [];
  for (let i = 1; i + 4 < fields.length; i += 5) {
    let additions = 0;
    let deletions = 0;
    for (const line of fields[i + 4]!.trim().split("\n")) {
      const [added, removed] = line.split("\t");
      additions += Number(added) || 0;
      deletions += Number(removed) || 0;
    }
    entries.push({
      hash: fields[i]!,
      committedAt: fields[i + 1]!,
      author: fields[i + 2]!,
      subject: fields[i + 3]!,
      additions,
      deletions,
    });
  }
  return entries;
}

// Production ships a server-only snapshot so it needs neither Git nor repository credentials.
export async function readHistory(): Promise<ChangelogEntry[]> {
  if (process.env.NODE_ENV === "production") {
    return Bun.file(new URL("./history.json", import.meta.url)).json();
  }
  return readGitHistory();
}

let cached: Promise<ChangelogEntry[]> | undefined;
let expires = 0;

export function getHistory() {
  if (!cached || Date.now() >= expires) {
    expires = Date.now() + 60000;
    cached = readHistory();
  }
  return cached;
}
