# Contributing

BetterWatch currently targets desktop Chrome, Netflix, Prime Video, and HBO
Max. Keep skip behavior and Trakt tracking independent, and preserve upstream
license notices when changing inherited code.

## Development

Install the Bun version in `package.json` (`packageManager`) and Chrome 120+.

```sh
bun install --frozen-lockfile
bun run check
bun run build
bun run package:check
bun run smoke:preview
```

Load `build/chrome` in `chrome://extensions`. Use `bun run dev` for source
rebuilds and `bun run preview` for the mock UI harness. Reload the installed
extension and streaming tabs after changes. The preview cannot access real
streaming sessions or authorize Trakt.

Manage dependencies with Bun and commit `bun.lock` alongside package changes.
Keep the pinned Bun version and `@types/bun` aligned. Match the surrounding
code style; avoid unrelated formatting changes. Local `.env` variants are
ignored, and only `.env.example` belongs in the repository.

Repository checks reject incompatible peer versions between direct packages.
Keep the MUI package family compatible when updating it; Dependabot groups
MUI updates so related major upgrades can be reviewed together.

## Changes and reviews

Open an issue for larger changes so scope can be discussed. Keep pull requests
focused, explain the resulting behavior, and include screenshots for UI work.
Add meaningful regression coverage for behavior changes and an Unreleased
entry in [CHANGELOG.md](CHANGELOG.md) for user-visible changes.

Run the commands above before submitting. CI repeats them on Linux, macOS,
and Windows. Linux must pass before the macOS/Windows jobs start; workflow
syntax is checked when workflow/action files change. Its Linux job uploads the ZIP,
checksum, and a preview release description for 14 days.

For player or Trakt changes, record which authenticated checks from
[docs/TESTING.md](docs/TESTING.md) were performed. State any checks that still
need an account. Never attach tokens, client secrets, cookies, or private
viewing history. Report vulnerabilities through [SECURITY.md](SECURITY.md).

Release instructions are in [docs/RELEASING.md](docs/RELEASING.md).
