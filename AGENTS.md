# Sonosphere

Scrobbling service and music community. Bun server (`server/`), React frontend (`src/`), shared types (`shared/`). Read `DESIGN.md` before UI work.

## Commands

Use Bun only, never npm/Node.

- `bun run dev`: dev server on :3000 (runs migrations, imports dev data, starts workers)
- `bun run typecheck`, `bun run build`, `bunx biome format --write <files>`
- `bun run db:generate`: migration from `server/db/schema.ts` changes

Never run `bun run reset`. Importing any DB module runs migrations against `DATABASE_URL`.

## Code style

- Near-zero comments. Only explain a non-obvious why.
- No crammed one-liners, no unreachable fallbacks, no speculative abstractions.
- Delete dead code; don't leave it commented out or unused.
- Match the surrounding feature's patterns: routes, `repo.ts` queries, services.
- Use existing helpers: `bad`/`fail`/`missing`, guards in `server/guards.ts`, `limit`, `paging`.
- Request bodies are untrusted; validate every field.
- Every user-facing string goes through i18n in all `shared/i18n/*` locales.
- UI: keep Astryx components and restyle in `src/styles.css`. Use `<Arrow>`, never a unicode arrow. No em dashes.
- Don't hand-edit generated `src/themes/sonosphere/sonosphere.*` files.

## Gotchas

- `c.user` is the effective viewer, `c.actor` the real session owner (differ while impersonating). Authorize against `c.user`; use `owner()` for account-security actions.
- Scrobbles dedupe on user + track + played-at second. `user_artists/albums/tracks` are trigger-maintained tallies; keep them consistent. Histories can be millions of rows: work set-based.
- `api<T>("/me")` adds the `/api` prefix.
- Hot reload must not stack timers or sockets; follow the `globalThis` patterns.
- Never print or commit secrets, `.env`, or local data.

## Before finishing

Format touched files, typecheck, build for frontend changes. Commit only when asked, terse one-line messages. Report what you actually verified.
