import { spawn, spawnSync } from 'node:child_process'
import { createServer } from 'node:net'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import electronPath from 'electron'

const appRoot = resolve(import.meta.dirname, '..')
const toolNames = {
  'json-formatter': 'JSON Formatter',
  base64: 'Base64 Encoder',
  'url-encoder': 'URL Encoder',
  'jwt-decoder': 'JWT Decoder',
  'hash-generator': 'Hash Generator',
  'uuid-generator': 'UUID Generator',
  'timestamp-converter': 'Timestamp Converter'
}
const themeIds = ['toxic-green', 'crimson-reactor', 'cyber-blue', 'purple-haze', 'solar-flare', 'arctic-frost']
const themeNames = ['Toxic Green', 'Crimson Reactor', 'Cyber Blue', 'Purple Haze', 'Solar Flare', 'Arctic Frost']

const failures = []
const check = (name, ok, detail) => {
  const suffix = detail === undefined ? '' : ` -> ${JSON.stringify(detail)}`
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${suffix}`)
  if (!ok) failures.push(name)
}
const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms))

async function freePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer()
    server.unref()
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : null
      server.close(() => (port ? resolvePort(port) : reject(new Error('no port assigned'))))
    })
  })
}

async function waitForTarget(port, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`, {
        signal: AbortSignal.timeout(3000)
      })
      const targets = await response.json()
      const page = targets.find((target) => target.type === 'page')
      if (page) return page
    } catch {
      // DevTools endpoint not ready yet
    }
    await sleep(300)
  }
  throw new Error('Timed out waiting for the renderer DevTools target')
}

async function waitForTargetGone(port, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const targets = await (
        await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(3000) })
      ).json()
      if (!targets.some((target) => target.type === 'page')) return true
    } catch {
      return true
    }
    await sleep(200)
  }
  return false
}

function connect(webSocketUrl) {
  const ws = new WebSocket(webSocketUrl)
  const pending = new Map()
  const logs = []
  let seq = 0

  ws.onmessage = (event) => {
    const message = JSON.parse(event.data)
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message)
      pending.delete(message.id)
      return
    }
    if (message.method === 'Log.entryAdded') {
      logs.push({
        source: message.params.entry.source,
        level: message.params.entry.level,
        text: message.params.entry.text
      })
    }
    if (
      message.method === 'Runtime.consoleAPICalled' &&
      ['error', 'warning'].includes(message.params.type)
    ) {
      logs.push({
        source: 'console',
        level: message.params.type,
        text: message.params.args.map((arg) => arg.value ?? arg.description ?? '').join(' ')
      })
    }
    if (message.method === 'Runtime.exceptionThrown') {
      logs.push({ source: 'exception', level: 'error', text: message.params.exceptionDetails.text })
    }
  }

  const call = (method, params = {}) =>
    new Promise((resolveCall, rejectCall) => {
      const id = ++seq
      pending.set(id, resolveCall)
      ws.send(JSON.stringify({ id, method, params }))
      setTimeout(() => {
        if (pending.delete(id)) rejectCall(new Error(`CDP timeout: ${method}`))
      }, 20000)
    })

  const evaluate = async (expression) => {
    const response = await call('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    })
    const details = response.result?.exceptionDetails
    if (details) throw new Error(details.exception?.description ?? details.text)
    return response.result?.result?.value
  }

  const ready = new Promise((resolveReady, rejectReady) => {
    const timer = setTimeout(() => rejectReady(new Error('DevTools WebSocket did not open')), 10000)
    ws.onopen = () => {
      clearTimeout(timer)
      resolveReady()
    }
    ws.onerror = () => {
      clearTimeout(timer)
      rejectReady(new Error('Unable to open the DevTools WebSocket'))
    }
  })

  return { ws, logs, call, evaluate, ready }
}

function stopProcess(child, profileDir) {
  if (process.platform === 'win32') {
    if (child && child.exitCode === null) {
      spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
    }
    const marker = profileDir.slice(profileDir.lastIndexOf('devtoolkit-e2e-'))
    spawnSync(
      'powershell',
      [
        '-NoProfile',
        '-Command',
        `Get-CimInstance Win32_Process -Filter "Name='electron.exe'" | Where-Object { $_.CommandLine -like '*${marker}*' } | ForEach-Object { (Invoke-CimMethod -InputObject $_ -MethodName Terminate) | Out-Null }`
      ],
      { stdio: 'ignore' }
    )
  } else if (child && child.exitCode === null) {
    child.kill('SIGTERM')
  }
  child?.stdout?.destroy()
  child?.stderr?.destroy()
  child?.unref()
}

const port = await freePort()
const profileDir = await mkdtemp(join(tmpdir(), 'devtoolkit-e2e-'))
const child = spawn(
  electronPath,
  [
    appRoot,
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profileDir}`,
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-features=CalculateNativeWindowOcclusion'
  ],
  { cwd: appRoot, stdio: ['ignore', 'pipe', 'pipe'] }
)

let rendererOutput = ''
child.stdout?.on('data', (chunk) => (rendererOutput += chunk))
child.stderr?.on('data', (chunk) => (rendererOutput += chunk))

let session
try {
  const target = await waitForTarget(port)
  session = connect(target.webSocketDebuggerUrl)
  await session.ready
  await session.call('Log.enable')
  await session.call('Runtime.enable')
  await sleep(1200)

  const { evaluate, logs } = session

  await evaluate(`location.hash = '#/home'; true`)
  await sleep(400)
  const home = await evaluate(`(() => ({
    title: document.title,
    hash: location.hash,
    theme: document.documentElement.dataset.theme,
    scheme: document.documentElement.dataset.scheme,
    hero: document.body.innerText.includes('Every small tool'),
    csp: document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content ?? ''
  }))()`)

  check('window loads home route', home.hash === '#/home' && home.hero, home)
  check('window title', /Dev Toolkit$/.test(home.title), home.title)
  check('default theme', home.theme === 'cyber-blue' && home.scheme === 'dark', { theme: home.theme, scheme: home.scheme })
  check('strict CSP meta present', home.csp.includes("default-src 'none'") && home.csp.includes("script-src 'self' file:") && home.csp.includes("connect-src 'none'"), home.csp)

  const pickerNames = await evaluate(`(async () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await new Promise((r) => setTimeout(r, 150))
    document.querySelector('.theme-trigger').click()
    await new Promise((r) => setTimeout(r, 350))
    const names = [...document.querySelectorAll('.theme-option-name')].map((el) => el.textContent.trim())
    document.body.click()
    return names
  })()`)
  check('six themes listed', pickerNames.join() === themeNames.join(), pickerNames)

  const applied = []
  for (let index = 0; index < themeIds.length; index += 1) {
    const value = await evaluate(`(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
      await new Promise((r) => setTimeout(r, 150))
      document.querySelector('.theme-trigger').click()
      await new Promise((r) => setTimeout(r, 250))
      const option = [...document.querySelectorAll('.theme-option')].find(
        (el) => el.querySelector('.theme-option-name')?.textContent.trim() === ${JSON.stringify(themeNames[index])}
      )
      option?.click()
      await new Promise((r) => setTimeout(r, 200))
      return document.documentElement.dataset.theme
    })()`)
    applied.push(value)
  }
  check('all themes apply', applied.join() === themeIds.join(), applied)

  const persisted = await evaluate(`localStorage.getItem('devkit:theme')`)
  check('theme choice persists', persisted === themeIds.at(-1), persisted)

  const searchResults = await evaluate(`(async () => {
    location.hash = '#/home'
    await new Promise((r) => setTimeout(r, 350))
    const el = document.querySelector('input[type="search"], input[placeholder*="earch"]')
    if (!el) return null
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, 'base64')
    el.dispatchEvent(new Event('input', { bubbles: true }))
    await new Promise((r) => setTimeout(r, 300))
    return [...document.querySelectorAll('.nav-item')].map((item) => item.textContent.trim())
  })()`)
  check('search filters the tool list', Array.isArray(searchResults) && searchResults.length === 1 && searchResults[0].includes('Base64'), searchResults)

  const routed = []
  for (const [id, name] of Object.entries(toolNames)) {
    const heading = await evaluate(`(async () => {
      location.hash = '#/${id}'
      await new Promise((r) => setTimeout(r, 450))
      const haystack = document.querySelector('main')?.innerText ?? document.body.innerText
      return haystack.includes(${JSON.stringify(name)})
    })()`)
    routed.push({ id, ok: heading === true })
  }
  check('every ready tool renders', routed.every((entry) => entry.ok), routed)

  const jsonOutput = await evaluate(`(async () => {
    location.hash = '#/json-formatter'
    await new Promise((r) => setTimeout(r, 500))
    const el = document.querySelector('textarea[aria-label="JSON input"]')
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, '{"b":2,"a":1}')
    el.dispatchEvent(new Event('input', { bubbles: true }))
    await new Promise((r) => setTimeout(r, 100))
    ;[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Format JSON').click()
    await new Promise((r) => setTimeout(r, 350))
    return document.querySelector('textarea[aria-label="Formatted JSON output"]')?.value ?? null
  })()`)
  check('JSON formatter works through the UI', typeof jsonOutput === 'string' && jsonOutput.includes('"a": 1'), jsonOutput)

  const ipc = await evaluate(`(async () => ({
    platform: window.devkit?.platform,
    version: await window.devkit?.app.version(),
    maximized: await window.devkit?.window.isMaximized()
  }))()`)
  check('preload bridge responds', typeof ipc.platform === 'string' && /^\d+\.\d+\.\d+/.test(ipc.version ?? ''), ipc)
  check('window is not maximized at start', ipc.maximized === false, ipc.maximized)

  const violations = logs.filter((entry) => /content security policy|refused to|violates/i.test(entry.text))
  check('no CSP violations', violations.length === 0, violations)
  const errors = logs.filter(
    (entry) => entry.level === 'error' && !/Autofill|DevTools/i.test(entry.text)
  )
  check('no console errors', errors.length === 0, errors)

  session.call('Runtime.evaluate', { expression: 'window.devkit.window.close()' }).catch(() => undefined)
  const windowClosed = await waitForTargetGone(port)
  session.ws.close()
  check('window close IPC closes the window', windowClosed)
} catch (error) {
  console.error('E2E ERROR:', error.message)
  if (rendererOutput.trim()) console.error(rendererOutput.trim().split('\n').slice(-20).join('\n'))
  failures.push('e2e run')
} finally {
  session?.ws.close()
  stopProcess(child, profileDir)
  await rm(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 250 }).catch(() => undefined)
}

if (failures.length > 0) {
  console.error(`\n${failures.length} check(s) failed: ${failures.join(', ')}`)
  process.exit(1)
}
console.log('\nAll E2E smoke checks passed.')
process.exit(0)
