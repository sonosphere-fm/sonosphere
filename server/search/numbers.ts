const UNITS =
  "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen".split(
    " "
  );
const TENS = "_ _ twenty thirty forty fifty sixty seventy eighty ninety".split(" ");

// longest first, so "twenty two" becomes 22 rather than "20 2"
export const NUMBER_WORDS: [string, string][] = [
  ...TENS.slice(2).flatMap((t, i) =>
    UNITS.slice(1, 10).map((u, j): [string, string] => [`${t} ${u}`, String((i + 2) * 10 + j + 1)])
  ),
  ...TENS.slice(2).map((t, i): [string, string] => [t, String((i + 2) * 10)]),
  ...UNITS.map((u, i): [string, string] => [u, String(i)]),
  ["hundred", "100"],
  ["thousand", "1000"],
];

const value = new Map(NUMBER_WORDS);
const words = new RegExp(`(?<![\\p{L}\\p{N}])(${NUMBER_WORDS.map(([w]) => w).join("|")})(?![\\p{L}\\p{N}])`, "gu");

/** "two phones" as "2 phones", for a key from looseKey(). */
export const digits = (key: string) => key.replace(words, (w) => value.get(w)!);
