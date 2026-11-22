// Registered directly with Bun, outside authentication and user request budgets.
export async function readiness(checkDatabase: () => Promise<unknown>): Promise<Response> {
  try {
    await checkDatabase();
    return new Response("ready\n", { headers: { "Cache-Control": "no-store" } });
  } catch {
    return new Response("not ready\n", { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
