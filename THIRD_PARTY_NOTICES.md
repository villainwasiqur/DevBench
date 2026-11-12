# Third-party notices

DevBench is distributed under the [MIT License](LICENSE), Copyright © 2026 Anonymous Villain.

It is built with open-source software. The direct components and their licenses are listed below. Full license texts are available in each package's `LICENSE` file under `node_modules/` in the source checkout, and in the installed application for the Electron runtime files noted below.

## Runtime dependencies

| Package | Version | License |
| --- | --- | --- |
| he | 2.0.0 | MIT |
| react | 19.3.1 | MIT |
| react-dom | 19.3.1 | MIT |
| sql-formatter | 15.9.0 | MIT |
| uqr | 0.1.3 | MIT |
| yaml | 2.9.1 | ISC |

## Bundled desktop platform

The Windows installer includes the Electron runtime and its embedded components:

| Component | License | License file in the installed app |
| --- | --- | --- |
| Electron | MIT | `LICENSE.electron.txt` |
| Chromium and its third-party components | BSD-3-Clause and others | `LICENSES.chromium.html` |
| Node.js | MIT | Included with the Electron license files |

These files are installed alongside `DevBench.exe`. Do not remove them when redistributing the application.

## Build and test tooling

The following packages are used to build, test, and package the app. They are not part of the shipped application bundle.

| Package | License |
| --- | --- |
| electron-builder | MIT |
| electron-vite | MIT |
| vite | MIT |
| vitest | MIT |
| @vitejs/plugin-react | MIT |
| TypeScript | Apache-2.0 |
| @types/he, @types/node, @types/react, @types/react-dom | MIT |

If you redistribute a modified build, keep this notice, the [LICENSE](LICENSE), and the Electron/Chromium license files together with the application.
