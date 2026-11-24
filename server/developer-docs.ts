export function llmsTxt() {
  return new Response(Bun.file(new URL("./llms.txt", import.meta.url)), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
