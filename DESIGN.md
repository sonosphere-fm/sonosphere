# Sonosphere design philosophy

Sonosphere (sonosphere.fm) is a scrobbling service and music community. People connect a player, scrobble what they listen to, and explore their history, community charts, recommendations, tags, and concerts. The interface should feel like a well-edited music publication with useful tools attached: album artwork, readable charts, personal profiles, clear navigation, and controls that respond immediately.

The visual identity comes from warm paper (or deep indigo in dark mode), dark ink, cobalt blue, sun yellow, strong typography, and square-edged geometry. Music and people supply the imagery. The interface supplies structure.

This document guides new features and changes to existing screens. Follow the established components and the final computed styles rather than copying an isolated early rule from the stylesheet.

## 1. Core principles

### Content carries the personality

Artists, records, listening history, and community activity should be the most interesting things on a screen. Give artwork enough room to be recognizable. Make names and numbers easy to scan. Keep the surrounding interface calm.

### Editorial structure, practical density

Use typography, alignment, spacing, and horizontal rules to organize information. A chart should read like a chart; a profile should read like a person's page; settings should work like a straightforward tool. Leave breathing room between sections while keeping related rows and controls close together. Long listening histories need useful density, not oversized containers around every item.

### A small, recognizable visual vocabulary

Repeat the same fonts, colors, surfaces, button shapes, and interaction states. A new feature should look like it belongs to Sonosphere on its first render.

### Immediate, dependable interaction

Clicks update the interface without theatrical movement. Dragging follows the pointer. Errors explain what happened and preserve work where possible. Loading states communicate real activity.

### Every word earns its place

Use text to identify content, explain a consequence, or help someone complete a task. Remove introductory slogans and decorative metadata from functional interfaces. Marketing surfaces (the landing page, social card, page titles) may carry the tagline "Track what you love"; tools may not.

## 2. Color and surfaces

Use semantic tokens instead of introducing local approximations of the palette. All tokens are defined with `light-dark()` pairs on `:root`.

### Core tokens

| Role                     | Token           | Light     | Dark      |
| ------------------------ | --------------- | --------- | --------- |
| Page background          | `--bg`          | `#f6f2e9` | `#0c0f27` |
| Recessed/grouped surface | `--panel`       | `#ece7db` | `#121636` |
| Card surface             | `--card`        | `#fffdf7` | `#181d45` |
| Main text                | `--ink`         | `#17150f` | `#f3efe4` |
| Secondary text           | `--ink-2`       | `#45413a` | `#d3d0d8` |
| Supporting text          | `--muted`       | `#6b665c` | `#9da2c6` |
| Subtle divider           | `--line`        | `#d9d2c3` | `#262c5e` |
| Control border           | `--edge`        | `#bfb7a5` | `#3a4385` |
| Neutral control fill     | `--fill`        | `#e6e0d2` | `#1f2659` |
| Neutral hover fill       | `--fill-hover`  | `#d9d2c3` | `#29316e` |
| Primary action accent    | `--accent`      | `#2438d6` | `#5468ff` |
| Accent hover             | `--accent-dark` | `#1a299f` | `#6b7dff` |
| Link                     | `--link`        | `#2438d6` | `#ffd257` |
| Sun yellow               | `--sun`         | `#ffcf33` | `#ffcf33` |
| Yellow hover             | `--sun-dark`    | `#f2bd0e` | `#f2bd0e` |
| Text on yellow           | `--on-sun`      | `#17150f` | `#17150f` |
| Text on accent           | `--on-accent`   | `#ffffff` | `#ffffff` |
| Success                  | `--ok`          | `#1b7a3d` | `#6fd492` |
| Error                    | `--bad`         | `#c2321f` | `#ff8f7d` |

### Supporting tokens

| Role                                  | Token                        | Light                 | Dark                      |
| ------------------------------------- | ---------------------------- | --------------------- | ------------------------- |
| Masthead and footer fill              | `--bar` / `--bar-hover`      | `#2438d6` / `#1a299f` | same (fixed cobalt)       |
| Yellow banner fill                    | `--banner`                   | `#ffcf33`             | same                      |
| Accent tint (selected/highlight fill) | `--accent-tint`              | `#ffe98a`             | `#2a3796`                 |
| Faint accent (row hover)              | `--accent-faint`             | `#ece7db`             | `#1f2659`                 |
| Now-playing row                       | `--now` / `--now-hover`      | `#ffe98a` / `#ffe066` | `#ffcf3314` / `#ffcf3321` |
| Now-playing text                      | `--np`                       | `#1a299f`             | `#ffd257`                 |
| Deepest ink surface                   | `--black`                    | `#17150f`             | `#070918`                 |
| Error tint                            | `--bad-tint`                 | `#f6d9d2`             | `#3a1e34`                 |
| Input inset shading                   | `--inset`                    | `#281e0a1a`           | `#00000073`               |
| Table zebra stripe                    | `--zebra`                    | `#78643c0d`           | `#8ca0ff09`               |
| Neutral tint                          | `--tint`                     | `#78643c1f`           | `#8ca0ff1a`               |
| Bar hover fill                        | `--bar-fill-hover`           | `#ffe066`             | `#3d50e0`                 |
| Missing artwork                       | `--art-none` / `--art-glyph` | `#e0d9ca` / `#bdb5a3` | `#1f2659` / `#343c7c`     |
| Scrollbars                            | `--scroll` / `--scroll-thin` | `#bdb4a2` / `#c9c1b0` | `#343c7c`                 |

### How to use the palette

- **Paper surfaces** are the default canvas. Separate areas with spacing, rules, or a small surface change. The sidebar and sub-navigation strip sit on `--panel`; cards sit on `--card`.
- **Cobalt** anchors the masthead and the footer, and marks standard primary actions. `--bar` stays cobalt in both modes.
- **Yellow** is a deliberate brand accent: the wordmark (masthead and the oversized footer wordmark), the active masthead marker (a yellow underline under the current section), the selected sub-tab (a solid yellow block, for example "All recommendations"), event date labels, chart bars, the footer's "Your library" button, uppercase footer column headings, selection highlight, and selected feature controls such as the image cropper's Rotate and Reset buttons.
- **Neutral fills** support secondary buttons, filters, and chips (for example, the tag chips under Popular tags) without competing with artwork.
- **Ink** creates hierarchy through headings and selected tabs.
- **Status colors** communicate an actual state. Pair color with text or an icon when the meaning matters.
- **Source badges** on recommendation cards are small colored circles (green, blue, orange) that indicate why something was recommended. They are one of the few places color carries category meaning; keep the set small and give each an accessible name.

Yellow buttons use dark text. Do not replace every existing blue primary action with yellow: both colors have established roles.

### Dark mode is its own composition

Dark mode uses deep indigo surfaces, warm off-white text, and **yellow links**. The masthead stays cobalt. Preserve surface separation and legibility rather than mechanically inverting light mode.

The site follows the system preference by default and lets people override it with the light/dark toggle (a moon icon in the footer). Theme is applied through `prefers-color-scheme` and a `data-theme` attribute, so new components must use the `light-dark()` tokens and never hard-code a mode. The static `color-scheme` meta in the HTML shell says `light` only for first paint; it does not mean dark mode is secondary.

Banner surfaces that are intentionally fixed (the yellow banner, the cobalt/black chart banners) keep their own pinned colors in both modes.

## 3. Typography

### Families

- **Source Sans 3 Variable:** body copy, forms, navigation, labels, timestamps, and table data.
- **Radio Canada Variable:** headings, page titles, wordmark text, and prominent statistics.
- **System monospace:** code and technical snippets only (for example, API keys and request examples on developer pages).

The legacy `--mono` token intentionally aliases the body font. Its name is not permission to set interface labels in monospace.

### Hierarchy

The body baseline is 16px with approximately 1.45 line height. Supporting text is usually 13px. Large page titles are around 36px, major profile/music headings around 44px, section titles around 22px, and sidebar headings around 17px. Use the existing page context rather than imposing the largest size everywhere.

- Headings are compact, generally bold, with slightly negative tracking.
- Body copy uses normal casing and comfortable line lengths; long prose is constrained to roughly 68 characters.
- Compact labels, banner headings, footer column headings, and standard solid buttons may use uppercase with modest letter spacing.
- Tables, chart counts, and listener counts use tabular numerals so values align and do not jump as they change.
- Artist and track names remain readable even when long. Wrap or truncate according to context, with the full value available when needed.
- Section links such as "View all →" are small, bold, link-colored, and right-aligned on the heading row.

Do not introduce another typeface for a single feature. Hierarchy should come from size, weight, and placement.

## 4. Geometry, borders, and depth

### Square edges are a defining feature

Buttons, inputs, tabs, chips, cards, menus, and dialogs use square corners. The Astryx theme sets radius tokens to zero; local styles must preserve that geometry.

"Square-edged" describes the corners, not a requirement for equal width and height. Text buttons should be wide enough for their labels and comfortable to use.

Intentional exceptions:

- **Circular:** user avatars, play buttons, and recommendation source badges.
- **Small radius (4px):** direct-message bubbles and the message composer, which read as conversation rather than chrome. Do not extend this to other components.

Artist and album artwork stays square.

### Rules give the page structure

Use fine `--line` dividers for rows and subtle boundaries (events, similar artists, chart rows). Stronger rules introduce some sections and banners: certain main sections use a 3px top rule in ink or accent, and sidebar headings may use a lighter 2px rule. Many sections, such as "Albums on the rise" and "Popular tags", rely on heading weight and spacing alone. Match the neighbors in the layout you are editing rather than adding a rule by default.

Cards can use a defined border when the content needs enclosure (recommendation cards, for example). Prefer a shared list or table over wrapping every row in a separate card.

### Depth is restrained

The base component theme removes decorative elevation. Existing exceptions include subtle inset shading in inputs, modest shadows for floating menus and tag suggestions, and masks in image-editing tools. These communicate a control boundary, layering, or a crop, not ornament.

Avoid large soft card shadows, glass surfaces, gradients on controls, rounded floating panels, and nested cards used only to fill space. Text laid over artwork (recommendation captions) sits on a darkening scrim so it stays legible.

## 5. Layout and information hierarchy

The masthead is a full-width cobalt bar about 58px tall: wordmark on the left; search, section links (Home, Charts, Events), and the avatar on the right. Below it, pages may add a sub-navigation strip on `--panel` for in-section tabs.

The main wrapper is capped at 1180px with 20px horizontal padding. Standard pages begin with about 24px of top spacing and 48px below their content. Forms use narrower columns, usually up to 560 to 640px.

Common layouts pair a flexible main column with a 320px sidebar and a 40px gap, separated by a fine vertical rule. At narrower widths the sidebar reduces or stacks below the main content.

The footer is a full-width cobalt block: an oversized yellow wordmark with a primary action, six columns of uppercase-labeled links (Music, Your music, Scrobbling, Developers, Community, Account), then a legal row with the theme toggle. Add new destinations to an existing column before creating a new one.

Use these as existing proportions, not rigid dimensions for every component.

### Page composition

1. Identify the page with a clear title or profile/music header.
2. Put relevant navigation and actions beside the content they affect.
3. Group related information into sections with consistent headings.
4. Keep secondary context in a sidebar or supporting row (quick-play actions, popular tags, upcoming events).
5. Let long collections use lists, charts, or tables.

Artwork grids and recommendation cards are for visual discovery. Tables and chart lists are for comparisons and histories. A settings form does not need a promotional hero.

### Established page patterns

- **Recommendation cards:** square artwork fills the card; title, artist, and listener count overlay the bottom of the artwork; a line below reads "By Artist, similar to …" with linked names; a circular play button sits on the artwork; a circular source badge sits at the lower right.
- **Chart lists:** compact rows with rank, circular play button, small square artwork, love toggle, name over artist, and a count with a yellow bar. Rows use zebra striping and a `--now` highlight for the playing track.
- **Events:** each row leads with a date block (yellow month label over a light day number), then title, performers, venue and city, and the "going" count at the trailing edge.
- **Sidebar quick actions:** circular play button plus label, separated by fine rules ("Play your library").
- **Banners:** full-width bands used on profile and chart pages, in cobalt or deep ink with white text and uppercase labels. The welcome message on Home is not a banner; it is plain content with a dismiss control.

### Responsive behavior

Reflow according to the content. Existing breakpoints span roughly 480 to 1100px, with major column stacking around 900px (and further adjustments near 860, 720, 700, and 600px).

- Stack form groups and toolbars when their contents stop fitting comfortably.
- Keep important actions reachable on small screens.
- Allow intentional horizontal scrolling for wide tables, with a clear scroll container.
- Do not shrink text or touch targets just to preserve a desktop arrangement; coarse-pointer styles enlarge targets.
- Check long usernames, track names, event titles, localized dates, and large counts.

## 6. Controls and navigation

### Buttons

Use `Button` from `src/kit.tsx` for standard actions. Its `kind` maps onto the themed Astryx variants:

| Kind                       | Purpose                               |
| -------------------------- | ------------------------------------- |
| `btn`                      | Primary action                        |
| `btn ghost`                | Secondary action                      |
| `btn danger`               | Destructive action                    |
| `small` modifier           | Compact version of a solid button     |
| Feature-specific/bare kind | Icon buttons and specialized controls |

Standard solid buttons are compact, square-edged, and typically uppercase. Existing medium buttons are 40px high; compact ones are 30px. Provide larger hit areas where touch interaction needs them.

Specialized controls can use native buttons when their interaction requires it, but must have explicit styling, focus, disabled, and hover states. They must not inherit an accidental browser or library appearance.

### Forms

Use visible labels, clear grouping, and the existing input components. Inputs use a lightly inset surface and a defined border. Focus adds a clear accent-colored treatment.

Keep validation near the relevant field or action. Explain how to recover. Preserve entered values after failure. Passwords, destructive actions, and account identity deserve explicit labels and consequences.

Tag entry uses tokenized tags with a suggestion list; keep that pattern for any new tag input.

### Tabs, filters, and chips

Tabs use rectangular blocks. In the sub-navigation strip the selected tab is a solid yellow block with dark text; in banners and the masthead the selected item is marked with an underline instead. Yellow hover states reinforce the identity. Chips are compact neutral rectangles, not pills. Avoid replacing existing tabs with rounded segmented controls.

### Dialogs

Use the shared `Modal` wrapper so dismissal and focus behavior stay consistent. Size the dialog to its task: small confirmations, wider visual editors. Keep the title, work area, error feedback, and final actions easy to distinguish.

A dialog should explain its task once. Do not add a slogan above a self-explanatory editor.

## 7. Artwork and personal expression

Album covers, artist photographs, user pictures, and profile banners carry the visual variety. Avoid generic stock imagery where real music or community imagery belongs.

- Preserve artwork proportions and use predictable cropping.
- Use circular presentation for user avatars, square artwork for records and artists.
- Profile banners use a 4:1 framing preview.
- Provide intentional loading, missing-image, and failed-image states using `--art-none` and `--art-glyph` (some records have no cover; the row should still look finished).
- Keep uploaded imagery separate from site chrome; a user's banner must not make controls unreadable.
- Text over artwork needs a scrim and must stay readable on both very light and very dark covers.

### Image editing

The cropper is a working surface: image, crop boundary, useful controls, save/cancel, and actionable errors.

Current product decisions:

- No introductory slogan or motivational sentence.
- No decorative `BANNER / 4:1` or `PROFILE / 1:1` labels.
- No explanatory sentence about the avatar circle or banner width.
- Rotate and Reset are visibly yellow, square-edged buttons with enough width (currently 96 x 64px).
- Dragging must work repeatedly, including after releasing outside the frame.
- Keyboard adjustment, touch input, zoom, rotation, and resetting must remain usable.
- Failed uploads preserve the crop. Cancel preserves the existing saved image.
- Keep relevant format warnings, such as GIF animation becoming a still image.

## 8. Motion, feedback, and performance

The default is **no transition**. The theme uses zero-duration motion tokens, and the stylesheet explicitly disables transitions. Controls change state immediately, without hover lifts, pressed scaling, entrance choreography, or fades.

Functional animation can communicate ongoing activity: a spinner, a now-playing indicator, or a progress bar that reports real progress (the import progress bar animates its width). Honor reduced-motion preferences and avoid motion that competes with music content.

Performance is part of the design:

- Avoid loading flashes for very fast responses; the page spinner already has a short delay.
- Preserve useful on-screen content during refreshes where possible.
- Show a busy state and prevent duplicate submissions while saving.
- Keep gestures independent of delayed React state updates.
- For genuinely long operations (imports, exports, deleting scrobbles), expose progress or a durable status rather than leaving a button apparently stuck.

## 9. Copy and tone

Write like a person helping someone use a music site: direct, specific, and brief. Address the person by name where it helps ("Welcome to Sonosphere, <username>"), and say what scrobbling does for them in plain terms ("The more you scrobble, the better these picks get.").

Prefer **"Crop your picture," "Save banner," "Remove," "Try again,"** and **"Deleted 240 scrobbles."**

Avoid promotional filler such as **"A little more you"** or **"Find the part you love. Make it yours."** These add noise inside tools without helping someone finish the task.

Guidelines:

- Name the action and the object.
- Explain irreversible consequences before confirmation.
- Use the actual account name when an action affects another user.
- Make impersonation unmistakable and provide a visible return action.
- Keep technical details when they explain a limitation or fix an error (for example, why an import skipped rows).
- Do not add badges, subtitles, or helper paragraphs merely to make a layout look finished.
- Use "scrobble" as the site's verb and noun; do not invent synonyms.

## 10. Accessibility and interaction quality

- Use semantic buttons, links, inputs, headings, and tables.
- Keep keyboard focus visible, including in dark mode and over imagery.
- Provide accessible names for icon-only controls (play, love, dismiss, search, theme toggle, source badges).
- Make custom pointer interactions operable with the keyboard.
- Do not depend on hover or color alone to communicate essential information. Chart bars carry their number; badges carry a name.
- Use status and alert semantics for meaningful feedback.
- Keep dialog focus management and dismissal behavior in the shared component system.
- Support forced-colors and coarse-pointer modes as existing components do.
- Test consecutive interactions, cancellation, failure, and retry, not just the first successful click.

Visual polish includes reliable behavior. A beautiful editor that stops responding after its first drag is unfinished.

## 11. Implementation and sources of truth

| File                                       | Responsibility                                                           |
| ------------------------------------------ | ------------------------------------------------------------------------ |
| `src/styles.css`                           | Site tokens, editorial layouts, component overrides, responsive behavior |
| `src/themes/sonosphere/sonosphereTheme.ts` | Authored Astryx theme, base geometry, colors, motion, component defaults |
| `src/themes/sonosphere/sonosphere.css`     | Generated theme output; regenerate rather than hand-edit                 |
| `src/kit.tsx`                              | Shared buttons, inputs, selectors, dialogs, and confirmations            |
| `src/theme.ts`                             | Light/dark/system preference application                                 |
| `src/ui/base.tsx`                          | Shared content and feedback building blocks                              |
| `src/icons.tsx`                            | Shared icon vocabulary                                                   |

Use `site-*` Tailwind utilities for site colors and fonts, such as `bg-site-card`, `text-site-muted`, and `font-site-display`. Unprefixed theme utilities belong to Astryx and can resolve differently.

The site stylesheet contains historical overrides, and some tokens and rules are defined more than once. Read the cascade through to its final rules before deciding what a component looks like. Prefer a focused change to the appropriate component or token over another broad override. Keep generated theme output in sync when the authored theme changes.

## 12. Review before shipping

- Does this look like Sonosphere beside the existing Home, charts, events, profile, and settings screens?
- Are the shapes square-edged, with only the intentional circular and message-bubble exceptions?
- Are cobalt, yellow, and neutral colors doing recognizable jobs?
- Is the music or user content more prominent than the decoration?
- Can any label or paragraph be removed without losing useful information?
- Are light and dark mode both legible, using tokens rather than fixed colors?
- Does the layout work on a narrow screen with long real-world content?
- Do keyboard, touch, focus, disabled, loading, error, and retry states work?
- Do repeated gestures and submissions behave as reliably as the first one?
- Have typechecks and relevant behavioral checks passed, and has the actual interface been inspected when a browser is available?

The goal is a coherent music site that is pleasant to read and dependable to use. Make that coherence stronger with each change.
