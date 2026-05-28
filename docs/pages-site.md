# GitHub Pages Site

This repository includes a static download and setup site under `site/`.

## Publish

1. Enable GitHub Pages for the repository if it is not already enabled.
2. Set the Pages source to the `gh-pages` branch.
3. Push to `main`, or run the `Publish GitHub Pages` workflow manually.

The Pages workflow publishes the `site/` directory to the `gh-pages` branch.

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

The `Build Release Asset` workflow builds the macOS arm64 zip, renames the
generated artifact to the stable asset name, and uploads it to the release.
For a manual run, use the workflow dispatch input `tag_name` with a value such
as `v0.1.0`.

## End-User Flow Covered By The Site

The published site is written for a user who needs to:

1. Download `genui-popup-broker-macos-arm64.zip`.
2. Move `GenUI Popup Broker.app` to `/Applications`.
3. Launch the unsigned app through Finder's right-click `Open` path.
4. Clone this repository for the agent-facing CLI.
5. Run `npm ci`.
6. Validate an example OpenUI Lang file.
7. Open the first popup with `npm run genui -- popup`.

The app zip provides the resident broker. The CLI currently lives in this
repository and is invoked with `npm run genui`.

## Local Preview

Open the static site from the workspace:

```bash
python3 -m http.server 4173 --directory site
```

Then visit:

```text
http://127.0.0.1:4173/
```
