# GitHub Pages Site

This repository includes a static download and setup site under `site/`.

## Publish

1. Enable GitHub Pages for the repository if it is not already enabled.
2. Set the Pages source to GitHub Actions.
3. Push to `main`, or run the `Publish GitHub Pages` workflow manually.

The Pages workflow uploads the `site/` directory as a Pages artifact and
deploys it from GitHub Actions. No generated site branch is required.

## Release Asset

The site download button expects the latest GitHub Release to contain:

```text
genui-popup-broker-macos-arm64.zip
```

Create that asset automatically by pushing a tag:

```bash
git tag v0.1.0
git push origin v0.1.0
```

The `Build Release Asset` workflow builds the macOS arm64 zip, packages
`GenUI Popup Broker.app`, the standalone `genui` CLI, and `INSTALL.txt` under
the stable asset name, then uploads it to the release.
For a manual run, use the workflow dispatch input `tag_name` with a value such
as `v0.1.0`.

## User Flow Covered By The Site

The published site is written for the current developer-preview release zip,
where the app and the agent-facing CLI are bundled together. The intended user
flow is:

1. Download `genui-popup-broker-macos-arm64.zip`.
2. Move `GenUI Popup Broker.app` to `/Applications`.
3. Launch the unsigned app through Finder's right-click `Open` path.
4. Copy the bundled `genui` command to `~/.local/bin/genui`.
5. Validate an example OpenUI Lang file.
6. Open the first popup with `genui popup`.

If `genui doctor --start` or the first `genui popup` times out, the site should
direct users back to step 3. Gatekeeper can block CLI auto-start for unsigned
developer-preview builds until the app has been opened once through Finder.

The release zip provides both the resident broker and the CLI. The CLI runs
through the Electron runtime inside the installed app, and can fall back to
Node.js from `PATH` when the app has not been moved yet. End users do not need
to clone this repository or run `npm install` to try a popup.

For data-heavy examples, prefer a short OpenUI Lang file plus
`--context-file data.json`. Charts and tables can read context paths, for
example `LineChart("Daily Traffic", "...", " views", [], "daily", "date",
"pv")` or `DataTable("Top Pages", "...", [], [], "Landing pages", "pages")`.

## Local Preview

Open the static site from the workspace:

```bash
python3 -m http.server 4173 --directory site
```

Then visit:

```text
http://127.0.0.1:4173/
```
