# All-in-One Dev Toolkit

A fast, offline desktop toolbox for everyday developer utilities. Everything runs locally inside the app window — no uploads, no accounts, no telemetry.

Built with Electron, React, TypeScript, and Vite.

[![CI](https://github.com/AnonymousVillain35/All-In-One-Dev-Toolkit/actions/workflows/ci.yml/badge.svg)](https://github.com/AnonymousVillain35/All-In-One-Dev-Toolkit/actions/workflows/ci.yml)

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

All 15 tools are ready. The JSON Formatter, Base64, and Hash tools accept files through the picker in the editor header or by dragging a file onto the editor.

Press **Ctrl+K** anywhere to open the command palette, which fuzzy-searches tools and shows recents and favorites. Star a tool from its header to pin it above the sidebar categories. Tool inputs and options persist across launches; secrets and tokens never do.

## Themes

Six hand-tuned palettes with a premium, theme-aware interface:

- Toxic Green
- Crimson Reactor
- Cyber Blue
- Purple Haze
- Solar Flare
- Arctic Frost (light)

The palette choice persists across launches.

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
```

The end-to-end smoke test opens a real application window, checks routing, search, the command palette, favorites, all six themes, the preload IPC bridge, CSP, window close, and every ready tool — including SQL formatting, color conversion, QR previews, cron explanations, URL form encoding, HMAC hashing, JWT verification, UUID kinds, and time-zone conversion.

## Windows installer

```bash
npm run build:win
```

This produces an unsigned NSIS x64 installer in `release/`:

```text
release/All-In-One-Dev-Toolkit-0.5.0-Setup.exe
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

## Privacy

All transformations run in the renderer with no network calls. Pasted content never leaves the machine.

The single exception is opt-in: the JWT tool can fetch a JWKS document from an HTTPS URL you type in, through a size- and time-limited main-process request. Nothing is fetched unless you press **Fetch JWKS**, and the renderer CSP keeps blocking all direct network access.

## Releases

Version history is tracked in [CHANGELOG.md](CHANGELOG.md).

## License

MIT
