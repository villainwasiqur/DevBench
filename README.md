# All-in-One Dev Toolkit

A fast, offline desktop toolbox for everyday developer utilities. Everything runs locally inside the app window — no uploads, no accounts, no telemetry.

Built with Electron, React, TypeScript, and Vite.

[![CI](https://github.com/AnonymousVillain35/All-In-One-Dev-Toolkit/actions/workflows/ci.yml/badge.svg)](https://github.com/AnonymousVillain35/All-In-One-Dev-Toolkit/actions/workflows/ci.yml)

## Tools

| Tool | Status |
| --- | --- |
| JSON Formatter | Ready |
| Base64 Encoder / Decoder | Ready |
| URL Encoder / Decoder | Ready |
| JWT Decoder | Ready |
| Hash Generator (SHA-1, SHA-256, SHA-384, SHA-512) | Ready |
| UUID Generator | Ready |
| Timestamp Converter | Ready |
| JSON ↔ YAML | Planned |
| SQL Formatter | Planned |
| Diff Checker | Planned |
| HTML Entities | Planned |
| Regex Tester | Planned |
| QR Code Generator | Planned |
| Cron Parser | Planned |
| Color Converter | Planned |

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

The end-to-end smoke test opens a real application window, checks routing, search, all six themes, the preload IPC bridge, CSP, and window close, then exits.

## Windows installer

```bash
npm run build:win
```

This produces an unsigned NSIS x64 installer in `release/`:

```text
release/All-In-One-Dev-Toolkit-0.2.0-Setup.exe
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

## Releases

Version history is tracked in [CHANGELOG.md](CHANGELOG.md).

## License

MIT
