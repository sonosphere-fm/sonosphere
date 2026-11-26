<p align="center">
  <a href="https://sonosphere.fm"><img src="brand/readme-banner.svg" alt="sonosphere" width="100%"></a>
</p>

<p align="center">
  <b>Track what you love.</b>
</p>

<p align="center">
  <a href="https://sonosphere.fm">sonosphere.fm</a> ·
  <a href="https://sonosphere.fm/help">Scrobbling help</a> ·
  <a href="https://sonosphere.fm/developers">API docs</a> ·
  <a href="https://discord.gg/sonosphere">Discord</a>
</p>

[Sonosphere](https://sonosphere.fm) is a free music tracking and discovery site. It keeps a log of what you listen to, builds your charts and listening reports, and helps you find new music and people with similar taste.

## Scrobble where you already listen

Sonosphere doesn't require you to migrate to a new music player. Connect Spotify, log plays from your Discord status, scrobble manually, or point your existing scrobbler at us.

We feature full support and compatibility with the Last.fm 2.0 and ListenBrainz protocols, so most existing apps and libraries will work with just a change of server URL.

If you're not ready to fully make the switch to Sonosphere, we've got you covered. Our relay allows you to scrobble to both Sonosphere and your existing service at the same time.

And finally, if you have a history of scrobbles and loved tracks somewhere else, you can import them into Sonosphere with one click. In the spirit of open data and portability, we allow users to [import data](https://sonosphere.fm/import) from Last.fm, ListenBrainz, CSV, or JSON and [export](https://sonosphere.fm/settings/data) their entire history back out as CSV or JSON anytime.

## Free API

Sonosphere will always be free to use, including our API. We believe that charging for access to your own data is a violation not only of the basic principles of data ownership, but of the open web itself. Service providers - including us - have no right to hold your data hostage, demanding money merely to integrate it into your own projects.

API keys are free for all users, with full access to our Last.fm 2.0 and ListenBrainz endpoints. Public Last.fm-compatible reads do not require a key; writes and private account context do. If you'd simply like to display what you're currently playing on a personal website, we also support a public, unauthenticated now-playing endpoint (JSON, SSE, and WebSockets). Full details are in the [API docs](https://sonosphere.fm/developers).

## Local development

To run Sonosphere locally, you need [Bun](https://bun.sh) and Postgres:

```sh
bun install
bun run dev
```

This starts the server on `:3000`, runs migrations, and loads the dev database.

## Contributing

We welcome contributions from the community. Please refer to the [CONTRIBUTING.md](CONTRIBUTING.md) file for more details.

## License

Sonosphere is licensed under the [Apache License 2.0](LICENSE). See [NOTICE](NOTICE) for the copyright notice and the terms for the Sonosphere name and logo, which are not covered by the license.
