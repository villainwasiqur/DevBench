# DevBench — All-in-One Dev Toolkit

A fast, offline desktop toolbox for everyday developer utilities. Everything runs locally inside the app window — no uploads, no accounts, no telemetry.

Built with Electron, React, TypeScript, and Vite. The installer and window are branded **DevBench**, while the repository keeps the All-in-One Dev Toolkit name.

[![CI](https://github.com/villainwasiqur/DevBench/actions/workflows/ci.yml/badge.svg)](https://github.com/villainwasiqur/DevBench/actions/workflows/ci.yml)

## Tools

| Tool | Status |
| --- | --- |
| JSON Formatter | Ready |
| JSON ↔ YAML | Ready |
| Diff Checker | Ready |
| Base64 Encoder / Decoder | Ready |
| URL Encoder / Decoder | Ready |
| HTML Entities | Ready |
| JWT Decoder (inspect, verify, and create tokens) | Ready |
| Hash Generator (SHA digests, HMAC, file hashing, compare) | Ready |
| Regex Tester | Ready |
| UUID Generator (v4, v7, ULID, nanoid, v3/v5) | Ready |
| Timestamp Converter (time zones, formats, durations) | Ready |
| SQL Formatter | Ready |
| QR Code Generator | Ready |
| Cron Parser | Ready |
| Color Converter | Ready |

All 15 tools are ready. The JSON Formatter, Base64, and Hash tools accept files through the picker in the editor header or by dragging a file onto the editor. The Regex Tester previews replacements with `$1`, `$&`, and `$<name>` references.

Press **Ctrl+K** anywhere to open the command palette, which fuzzy-searches tools and shows recents and favorites. Open **Settings** with **Ctrl+,** to switch themes or clear saved data, and press **?** to see the full keyboard shortcuts guide. Star a tool from its header to pin it above the sidebar categories. Tool inputs and options persist across launches; secrets and tokens never do. Settings can clear saved tool inputs at any time while keeping favorites, recents, the working set, and the theme.

## Working set

Outputs you explicitly save land in the **Working set** (sidebar entry, `#/history`, or the `Open working set` palette command). JSON, YAML, SQL, Regex, Base64, URL, and HTML Entities results offer a **Save** button beside the output. Saved entries can be pinned, copied, and removed per entry, per tool, or all at once.

The working set holds up to 30 entries, keeps pinned entries when trimming, and is preserved by **Clear saved inputs**. Tools that handle secrets — JWT Decoder and Hash Generator — cannot save outputs at all.

## Backup and restore

Settings exports every saved preference and tool input as a JSON file, including the working set and the chosen theme. Importing a backup replaces the current data and reloads the app. Backups stay on disk; nothing is uploaded.

## Themes

Six hand-tuned palettes with a premium, theme-aware interface:

- Toxic Green
- Crimson Reactor
- Cyber Blue
- Purple Haze
- Solar Flare
- Arctic Frost (light)

The palette choice persists across launches.

## Keyboard and accessibility

- **Ctrl+K** opens the command palette; **Ctrl+,** opens Settings; **?** shows the shortcut guide.
- Press **Tab** from the top of the window to reveal the skip link, which jumps focus to the main content.
- Dialogs trap focus, restore it when closed, and close with **Esc**. Every interactive control shows a visible focus ring.
- Status text and tool feedback use polite live regions, and reduced-motion preferences are respected.
- Every button, form control, and image on every page has an accessible name, verified by the end-to-end audit.

## Requirements

- Node.js 22 or newer
- Windows 10/11 (x64) for installers; the app also runs on macOS and Linux in development

## Getting started

```bash
npm install
npm run dev
```

## Verification

```bash
npm run typecheck   # TypeScript for main, preload, and renderer
npm test            # Vitest unit tests
npm run test:e2e    # Builds, then launches the app and runs the CDP smoke test
npm run build       # Typecheck plus production bundle
npm run budget      # Fails if the production JS/CSS exceeds the size budget
```

The end-to-end smoke test opens a real application window, checks routing, search, the command palette, favorites, all six themes, the preload IPC bridge, CSP, window close, backup export/import, and every ready tool — including SQL formatting, color conversion, QR previews, cron explanations, URL form encoding, HMAC hashing, JWT verification, UUID kinds, and time-zone conversion. It also drives real keyboard input: the skip link, arrow-key palette navigation, dialog focus trapping, and saving, pinning, and removing working-set entries.

## Windows installer

```bash
npm run build:win
```

This produces an unsigned NSIS x64 installer in `release/`:

```text
release/DevBench-1.0.0-Setup.exe
```

Because the installer is unsigned, Windows SmartScreen may show an “Unknown publisher” prompt. Choose **More info → Run anyway** to install.

## Architecture

```text
src/main/        Electron main process: window lifecycle, IPC, security policy
src/preload/     Sandboxed contextBridge API exposed as window.devkit
src/renderer/    React application, tools, themes, and utilities
scripts/         End-to-end smoke test
build/           Packaging resources (application icon)
```

The renderer is fully offline. The production Content Security Policy is generated at build time by `electron.vite.config.ts` and blocks scripts outside the app bundle, all network connections, remote frames, and objects.

Every page renders inside an error boundary keyed by route, so a task that fails unexpectedly shows a recovery screen with **Back to overview** and **Reload app** actions instead of blanking the window.

## Privacy

All transformations run in the renderer with no network calls. Pasted content never leaves the machine.

The single exception is opt-in: the JWT tool can fetch a JWKS document from an HTTPS URL you type in, through a size- and time-limited main-process request. Nothing is fetched unless you press **Fetch JWKS**, and the renderer CSP keeps blocking all direct network access.

## Releases

Version history is tracked in [CHANGELOG.md](CHANGELOG.md).

## Author

DevBench is designed and maintained by **Anonymous Villain** ([villainwasiqur](https://github.com/villainwasiqur)).

## License

DevBench is released under the [MIT License](LICENSE). Copyright © 2026 Anonymous Villain.

Third-party components keep their own licenses, and the installer bundles the Electron runtime with its own notices. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for the full list and redistribution notes.
