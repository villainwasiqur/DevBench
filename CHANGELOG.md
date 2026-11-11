# Changelog

All notable changes to All-in-One Dev Toolkit are documented here.

## [0.5.0] - 2026-11-11

### Added

- JWT signature verification for HS256/384/512, RS256, and ES256 using a local HMAC secret or a pasted JWK/JWKS, with optional HTTPS-only JWKS fetching through the main process.
- JWT creation with HS256, HS384, or HS512 signing and JSON claim editing.
- Hash Generator HMAC keys, file hashing up to 20 MB, Base64 digest output, and an expected-digest comparison with match status.
- UUID Generator UUID v7, ULID, nanoid (configurable length), and namespaced v3/v5 IDs, plus TXT, CSV, and JSON export with downloads.
- Timestamp Converter time-zone selection, custom format tokens, ISO week and UTC offset output, and a duration calculator between two moments.
- Command palette (Ctrl+K) with fuzzy search, recent tools, and favorites, navigable with the arrow keys and Enter.
- Favorites pinned above the sidebar categories, with a star toggle on every tool page.
- Per-tool persistence keeps the last input and options for every non-sensitive tool; JWT tokens, HMAC keys, and signing secrets are never stored.

### Changed

- The Hash Generator and UUID Generator rows and descriptions now reflect the expanded feature sets.
- The README documents the opt-in JWKS fetch exception and the command palette.

## [0.4.0] - 2026-11-10

### Added

- SQL Formatter with Standard SQL, PostgreSQL, MySQL, and SQLite dialects, keyword casing, and 2- or 4-space indentation.
- Color Converter for HEX, RGB, HSL, and OKLCH with alpha support, a live swatch, and an sRGB gamut warning.
- QR Code Generator with error-correction levels, an offline SVG preview, and SVG or PNG downloads.
- Cron Parser with plain-English field explanations, next-run previews, ranges, lists, steps, month and weekday names, and `@hourly`-style aliases.
- URL Encoder form-body mode (`+` for spaces) and a decoded query-parameter breakdown with JSON copy.
- Unit tests for the color, cron, QR, SQL, and URL logic.

### Changed

- All 15 tools are now ready; the Home page no longer shows an empty workshop section.
- The SQL dialects and QR encoder load on demand, keeping the initial bundle small.

## [0.3.0] - 2026-11-10

### Added

- Diff Checker with line-level additions and removals, optional whitespace and case insensitivity, swap, and per-side line numbers.
- Regex Tester with live highlights, capture groups (numbered and named), and `i`, `m`, `s`, and `u` flags.
- JSON ↔ YAML converter with key sorting, indentation control, anchor resolution, and multi-document support.
- HTML Entities encoder and decoder with named or numeric references.
- File loading for the JSON Formatter, Base64, and Hash tools: pick a file from the editor header or drag one onto the editor.
- Unit tests for the diff, regex, YAML, and HTML entity logic.

### Changed

- Eleven tools are now ready; only SQL Formatter, QR Code Generator, Cron Parser, and Color Converter remain planned.

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
