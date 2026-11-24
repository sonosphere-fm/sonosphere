# Sonosphere design

An editorial music site: warm paper (deep indigo in dark mode), ink type, cobalt, sun yellow, square edges. Artwork and people carry the personality; the chrome stays calm.

## Color

Use the `light-dark()` tokens in `src/styles.css` (`--bg`, `--panel`, `--card`, `--ink`, `--ink-2`, `--muted`, `--line`, `--edge`, `--fill`, `--accent`, `--link`, `--sun`, `--ok`, `--bad`) or `site-*` Tailwind utilities. Never hard-code a mode.

- Cobalt: masthead, footer, primary buttons. Yellow: wordmark, selected sub-tab, active nav underline, chart bars, highlights. Yellow surfaces take dark text.
- No blue on dark backgrounds. `--link` is cobalt in light and yellow in dark; use it for accent-colored text.
- Status colors only for real states, paired with text or an icon.

## Type

- Source Sans 3 for body and controls, Radio Canada (`font-site-display`) for headings and big numbers.
- No monospace except code. `--mono` aliases the body font.
- Compact bold headings with slight negative tracking. Tabular numerals for counts.

## Shape and depth

- Square corners everywhere. Exceptions: avatars, play buttons, source badges (circles); DM bubbles (4px).
- Structure with spacing and `--line` rules, not nested cards. Prefer lists and tables for collections.
- No decorative shadows, gradients, or glass. Inputs keep their inset shadow. Text over artwork gets a scrim.

## Controls

- Use `src/kit.tsx`: `Button kind="btn"` (primary), `"btn ghost"`, `"btn danger"`, `small`. `Modal`, `Input`, `SearchField`, `Select`.
- Keep Astryx components; restyle via CSS.
- Tags and chips: neutral rectangles, no outlines, no pills.
- Card hover changes the background, not the border. No aggressive hover changes.
- No transitions or pressed scaling. Only functional animation (spinners, real progress).
- Show busy states, block duplicate submits, keep input after errors.

## Copy

- Direct and brief: name the action and the object ("Save banner", "Deleted 240 scrobbles").
- No slogans, badges, or helper text that repeats an obvious control. The tagline is for marketing surfaces only.
- No em dashes. Use `<Arrow>`, never a unicode arrow.
- Every string goes through i18n in all locales.

## Check

Light and dark, narrow screens, long names, keyboard focus, touch, loading/error/disabled states, repeated gestures.
