import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'

const sharedCsp = [
  "default-src 'none'",
  "style-src 'self' file: 'unsafe-inline'",
  "img-src 'self' file: data:",
  "font-src 'self' file:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'"
]

const developmentCsp = [
  ...sharedCsp,
  "script-src 'self' file: 'unsafe-inline'",
  "connect-src 'self' ws://localhost:* http://localhost:* ws://127.0.0.1:* http://127.0.0.1:*"
].join('; ')

const productionCsp = [
  ...sharedCsp,
  "script-src 'self' file:",
  "connect-src 'none'"
].join('; ')

const cspPlugin: Plugin = {
  name: 'inject-csp',
  transformIndexHtml(html, ctx) {
    const policy = ctx.server ? developmentCsp : productionCsp
    return html.replace(
      '<!-- CSP -->',
      `<meta http-equiv="Content-Security-Policy" content="${policy}" />`
    )
  }
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    plugins: [react(), cspPlugin]
  }
})
