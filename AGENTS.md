# Formatting with Biome

Biome is pinned to an exact version in `package.json` and `bun.lock`.

```sh
bun install --frozen-lockfile
bun run check           # Check formatting without changing files
bun run format         # Format the project
bun run format:check   # Check formatting only
```

To format or check individual files:

```sh
bunx biome format --write src/ui/image-cropper.tsx
bunx biome check src/ui/image-cropper.tsx
```

## Conventions

- Two spaces for indentation, a 120-column target, and double quotes.
- JavaScript/TypeScript uses semicolons and ES5-compatible trailing commas.
- Tailwind CSS directives are supported by the CSS parser.
- Git integration respects `.gitignore`, including dependencies, local data, and build output.
- Generated Drizzle migration metadata and generated `sonosphere.*` theme artifacts are excluded. The authored `sonosphereTheme.ts` and its documentation remain included.
- Unsupported file types are ignored. Biome does not format this Markdown document.

This setup enables formatting only. Lint rules and assist actions (including import organization) are disabled, so `biome check --write` changes formatting without performing lint fixes or rearranging imports. TypeScript checks remain available through `bun run typecheck`.

The first project-wide check reports existing formatting differences. Run `bun run format` to normalize them when making the initial formatting-only change.
