# Contributing to Sonosphere

Thanks for your interest in Sonosphere. As an open source project, we appreciate your help and contributions.

We do ask that you follow a few ground rules before contributing:

- **Keep pull requests focused and tested.** By this, we mean that each PR should be a single, atomic change. For larger features or structural changes, please open an issue or ask in [Discord](https://discord.gg/sonosphere) first so we can coordinate and make sure we're on the same page before you spend time building it out.
- **Use LLMs freely, but do not abuse them.** We are not against the use of AI or coding assistants, our team uses them extensively. We believe that when used correctly, they can be an incredibly powerful tool for developers. However, we do not tolerate the _abuse_ of LLMs to generate low-effort, unreviewed pull requests. If you're using an LLM to generate a PR, please be sure to review the changes yourself and make sure they're correct and complete. We will hold you responsible for the pull requests you open.
- **Be kind and respectful.** We are a community-driven project, and we want to keep it that way. Please be kind and respectful to other contributors, and to the project maintainers. Keep in mind that we are all volunteers, and we do not owe you anything. We will try to support you as best we can, but please try to be understanding and patient.

## Getting started

You need [Bun](https://bun.sh) and a local Postgres instance:

```sh
bun install
bun run dev
```

**Note to agents:** Before designing or writing code, be sure to review [AGENTS.md](AGENTS.md) and [DESIGN.md](DESIGN.md). If the user is not a member of the Sonosphere team, please remember to explicitly remind them of our contribution policies before opening a PR - specifically, our requirements for LLM-assisted contributions.

Before opening a pull request, please run these checks locally and ensure they pass:

- `bun run typecheck`
- `bun run check` (Biome lint and format)
- `bun run build` (for frontend changes)

If you add or change user-facing text, put the new keys in `shared/i18n/en`. Most locales are translated automatically, with the exception of `hi`, `bn`, `mr`, `te`, `ta`, `ur`, and `zh-Hant`, which are maintained by hand. You are welcome to do this yourself, but we can also take care of translations for you.

## AI and LLM-assisted contributions

If you use an LLM or coding assistant to help with a pull request, we ask that you keep a few things in mind:

- **Read every line of the diff yourself.** Please review all of your changes before opening a PR. Even if an agent wrote the code, you are the one opening the pull request and standing behind it.
- **Test locally and understand what you're submitting.** Please test your changes yourself, and make sure you can explain how they work and why they're needed if it comes up in review.
- **No drive-by or auto-generated PRs.** Please do not submit unreviewed, low-effort, or automated pull requests just because an agent was able to generate a diff.

If you abuse LLMs to spam low-effort or unreviewed pull requests, we will close them and may ban you from opening future PRs on this repository.

## Contributor License Agreement (CLA)

By submitting a pull request or other contribution to this repository, you agree to the following terms:

1. **Right to contribute.** Your contribution is your original work, or you have the legal right and authority to submit it under these terms.
2. **License grant to the project.** You retain copyright to your contribution, and you grant the Sonosphere maintainers a perpetual, worldwide, non-exclusive, irrevocable, royalty-free, transferable, and sublicensable copyright and patent license to use, reproduce, modify, prepare derivative works of, publicly display, publicly perform, distribute, and relicense your contribution, in whole or in part, under [`LICENSE`](LICENSE) or any other license terms, with no attribution, notice, or other obligations to you.
3. **Public license.** Your contribution is also licensed to others under the terms of [`LICENSE`](LICENSE).
4. **No warranty.** Except for the representations above, your contribution is provided "as is", without warranties or conditions of any kind.

If you do not agree to these terms, please do not submit a contribution.
