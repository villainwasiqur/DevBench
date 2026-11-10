# Changelog

All notable changes to All-in-One Dev Toolkit are documented here.

## [0.2.0] - 2026-11-10

### Added

- Strict production Content Security Policy, with a separate development policy for hot reload.
- Electron hardening: sandboxed renderer, context isolation, denied permission requests, blocked webviews and unexpected navigation.
- Unit test suite (Vitest) covering JSON, Base64, JWT, and formatting utilities.
- End-to-end smoke test that launches the built app and verifies routing, search, themes, IPC, CSP, and window close.
- GitHub Actions CI: typecheck, unit tests, and build on Linux; Electron smoke test on Windows.
- Application icon and electron-builder configuration for an NSIS x64 installer.
- Test and release documentation in the README.

### Fixed

- The main window now appears immediately on launch instead of waiting for a `ready-to-show` event that could never fire.

## [0.1.0] - 2026-11-02

### Added

- Initial desktop shell with a custom frameless title bar and hash-based routing.
- Seven ready tools: JSON Formatter, Base64 Encoder / Decoder, URL Encoder / Decoder, JWT Decoder, Hash Generator, UUID Generator, and Timestamp Converter.
- Six persistent themes: Toxic Green, Crimson Reactor, Cyber Blue, Purple Haze, Solar Flare, and Arctic Frost.
- Offline-first architecture: all transformations run locally in the renderer.
