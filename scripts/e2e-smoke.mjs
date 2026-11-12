import { spawn, spawnSync } from 'node:child_process'
import { createServer } from 'node:net'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import electronPath from 'electron'

const appRoot = resolve(import.meta.dirname, '..')
const toolNames = {
  'json-formatter': 'JSON Formatter',
  'json-yaml': 'JSON ↔ YAML',
  'sql-formatter': 'SQL Formatter',
  'diff-checker': 'Diff Checker',
  base64: 'Base64 Encoder',
  'url-encoder': 'URL Encoder',
  'html-entities': 'HTML Entities',
  'jwt-decoder': 'JWT Decoder',
  'hash-generator': 'Hash Generator',
  'regex-tester': 'Regex Tester',
  'uuid-generator': 'UUID Generator',
  'qr-generator': 'QR Code Generator',
  'timestamp-converter': 'Timestamp Converter',
  'cron-parser': 'Cron Parser',
  'color-converter': 'Color Converter'
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

  const pressKey = async ({ key, code = key, windowsVirtualKeyCode, modifiers = 0 }) => {
    await session.call('Input.dispatchKeyEvent', {
      type: 'rawKeyDown',
      key,
      code,
      windowsVirtualKeyCode,
      modifiers
    })
    await session.call('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key,
      code,
      windowsVirtualKeyCode,
      modifiers
    })
    await sleep(160)
  }

  await evaluate(`location.hash = '#/home'; true`)
  await sleep(400)
  const home = await evaluate(`(() => ({
    title: document.title,
    hash: location.hash,
    theme: document.documentElement.dataset.theme,
    scheme: document.documentElement.dataset.scheme,
    hero: document.body.innerText.includes('Every small tool'),
    readyCount: document.body.innerText.includes('15 tools ready'),
    workshop: document.body.innerText.includes('In the workshop'),
    csp: document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content ?? ''
  }))()`)

  check('window loads home route', home.hash === '#/home' && home.hero, home)
  check('home reports fifteen ready tools', home.readyCount === true, home.readyCount)
  check('home has no coming-soon section', home.workshop === false, home.workshop)
  check('window title', /DevBench$/.test(home.title), home.title)
  check('default theme', home.theme === 'cyber-blue' && home.scheme === 'dark', { theme: home.theme, scheme: home.scheme })
  check('strict CSP meta present', home.csp.includes("default-src 'none'") && home.csp.includes("script-src 'self' file:") && home.csp.includes("connect-src 'none'"), home.csp)

  await evaluate(`document.activeElement?.blur(); true`)
  await pressKey({ key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
  await sleep(250)
  const skipLink = await evaluate(`(() => {
    const el = document.activeElement
    return {
      className: el?.className ?? null,
      text: el?.textContent?.trim() ?? null,
      top: Math.round(el?.getBoundingClientRect().top ?? -999)
    }
  })()`)
  check(
    'first Tab reaches the skip link',
    typeof skipLink.className === 'string' &&
      skipLink.className.includes('skip-link') &&
      skipLink.text === 'Skip to content' &&
      skipLink.top >= 0,
    skipLink
  )

  await pressKey({ key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
  const skipTarget = await evaluate(`({
    tag: document.activeElement?.tagName ?? null,
    id: document.activeElement?.id ?? null
  })`)
  check(
    'activating the skip link moves focus to main content',
    skipTarget.tag === 'MAIN' && skipTarget.id === 'main-content',
    skipTarget
  )

  await pressKey({ key: 'k', code: 'KeyK', windowsVirtualKeyCode: 75, modifiers: 2 })
  const paletteFocus = await evaluate(`(async () => {
    const snapshot = {
      open: Boolean(document.querySelector('.palette')),
      focused: document.activeElement?.getAttribute('aria-label') ?? null
    }
    const input = document.querySelector('input[aria-label="Command palette search"]')
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'sql')
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await new Promise((r) => setTimeout(r, 250))
    return snapshot
  })()`)
  await pressKey({ key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40 })
  await pressKey({ key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40 })
  const paletteSelected = await evaluate(`({
    index: [...document.querySelectorAll('.palette-item')].findIndex(
      (el) => el.getAttribute('aria-selected') === 'true'
    ),
    label:
      [...document.querySelectorAll('.palette-item')]
        .find((el) => el.getAttribute('aria-selected') === 'true')
        ?.querySelector('.palette-name')?.textContent ?? null
  })`)
  await pressKey({ key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
  const paletteKeyboard = await evaluate(`({
    hash: location.hash,
    closed: !document.querySelector('.palette'),
    focus: document.activeElement?.id ?? null
  })`)
  check(
    'keyboard alone opens the palette, moves, and opens a tool',
    paletteFocus.open === true &&
      paletteFocus.focused === 'Command palette search' &&
      paletteSelected.label === 'SQL Formatter' &&
      paletteKeyboard.hash === '#/sql-formatter' &&
      paletteKeyboard.closed === true &&
      paletteKeyboard.focus === 'main-content',
    { paletteFocus, paletteSelected, paletteKeyboard }
  )

  await pressKey({ key: '?', code: 'Slash', windowsVirtualKeyCode: 191, modifiers: 8 })
  const shortcutsFocus = await evaluate(`({
    open: Boolean(document.querySelector('.shortcuts-dialog')),
    focused: document.activeElement?.getAttribute('aria-label') ?? null
  })`)
  await pressKey({ key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
  const trapped = await evaluate(`document.activeElement?.getAttribute('aria-label') ?? null`)
  await pressKey({ key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
  const shortcutsKeyboard = await evaluate(`({
    closed: !document.querySelector('.shortcuts-dialog'),
    restored: document.activeElement?.id ?? null
  })`)
  check(
    'keyboard traps focus in the shortcuts dialog and Escape restores it',
    shortcutsFocus.open === true &&
      shortcutsFocus.focused === 'Close shortcuts' &&
      trapped === 'Close shortcuts' &&
      shortcutsKeyboard.closed === true &&
      shortcutsKeyboard.restored === 'main-content',
    { shortcutsFocus, trapped, shortcutsKeyboard }
  )

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
      const expected = ${JSON.stringify(themeNames[index])}
      const target = ${JSON.stringify(themeIds[index])}
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
      await new Promise((r) => setTimeout(r, 200))
      document.querySelector('.theme-trigger').click()

      const optionDeadline = Date.now() + 1500
      let option = null
      while (!option && Date.now() < optionDeadline) {
        option = [...document.querySelectorAll('.theme-option')].find(
          (el) => el.querySelector('.theme-option-name')?.textContent.trim() === expected
        )
        if (!option) await new Promise((r) => setTimeout(r, 50))
      }
      option?.click()

      const applyDeadline = Date.now() + 1500
      while (document.documentElement.dataset.theme !== target && Date.now() < applyDeadline) {
        await new Promise((r) => setTimeout(r, 50))
      }
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
    const results = [...document.querySelectorAll('.nav-item')].map((item) =>
      item.textContent.trim()
    )
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, '')
    el.dispatchEvent(new Event('input', { bubbles: true }))
    await new Promise((r) => setTimeout(r, 200))
    return results
  })()`)
  check(
    'search filters the tool list',
    Array.isArray(searchResults) &&
      searchResults.length === 2 &&
      searchResults[0].includes('Base64') &&
      searchResults[1].includes('Hash'),
    searchResults
  )

  const routed = []
  for (const [id, name] of Object.entries(toolNames)) {
    const heading = await evaluate(`(async () => {
      location.hash = '#/${id}'
      const deadline = Date.now() + 2500
      while (Date.now() < deadline) {
        const haystack = document.querySelector('main')?.innerText ?? document.body.innerText
        if (haystack.includes(${JSON.stringify(name)})) return true
        await new Promise((r) => setTimeout(r, 100))
      }
      return false
    })()`)
    routed.push({ id, ok: heading === true })
  }
  check('every ready tool renders', routed.every((entry) => entry.ok), routed)

  const a11yAudit = await evaluate(`(async () => {
    const toolIds = ${JSON.stringify(Object.keys(toolNames))}
    const routes = ['home', 'history', 'settings', ...toolIds]
    const problems = []
    const hasAccessibleName = (el) =>
      Boolean(
        el.getAttribute('aria-label')?.trim() ||
          el.getAttribute('title')?.trim() ||
          el.textContent?.trim()
      )
    for (const route of routes) {
      location.hash = '#/' + route
      await new Promise((r) => setTimeout(r, route === 'home' || route === 'settings' || route === 'history' ? 250 : 450))
      document.querySelectorAll('main button').forEach((el) => {
        if (!hasAccessibleName(el)) problems.push(route + ': button without an accessible name')
      })
      document.querySelectorAll('main input, main textarea, main select').forEach((el) => {
        const hasLabel =
          Boolean(el.getAttribute('aria-label')?.trim()) ||
          (el.id && document.querySelector('label[for="' + CSS.escape(el.id) + '"]')) ||
          Boolean(el.closest('label'))
        if (!hasLabel) problems.push(route + ': ' + el.tagName.toLowerCase() + ' without a label')
      })
      document.querySelectorAll('main img').forEach((el) => {
        if (!el.hasAttribute('alt')) problems.push(route + ': img without alt')
      })
    }
    return [...new Set(problems)]
  })()`)
  check('every page exposes accessible names', a11yAudit.length === 0, a11yAudit)

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

  const fileLoader = await evaluate(`(async () => {
    const fileInput = document.querySelector('.file-drop input[type="file"]')
    const openButton = [...document.querySelectorAll('button')].find(
      (button) => button.textContent.trim() === 'Open file'
    )
    return { fileInput: Boolean(fileInput), openButton: Boolean(openButton) }
  })()`)
  check('JSON tool exposes a local file loader', fileLoader.fileInput && fileLoader.openButton, fileLoader)

  const droppedFile = await evaluate(`(async () => {
    const zone = document.querySelector('.file-drop')
    const transfer = new DataTransfer()
    transfer.items.add(new File(['{"from":"file"}'], 'sample.json', { type: 'application/json' }))
    zone.dispatchEvent(new DragEvent('drop', { dataTransfer: transfer, bubbles: true, cancelable: true }))
    await new Promise((r) => setTimeout(r, 500))
    return document.querySelector('textarea[aria-label="JSON input"]')?.value ?? null
  })()`)
  check('dragging a file loads its text', droppedFile === '{"from":"file"}', droppedFile)

  const yamlOutput = await evaluate(`(async () => {
    location.hash = '#/json-yaml'
    await new Promise((r) => setTimeout(r, 500))
    const el = document.querySelector('textarea[aria-label="JSON input"]')
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, '{"name":"toolkit","items":[1,2]}')
    el.dispatchEvent(new Event('input', { bubbles: true }))
    await new Promise((r) => setTimeout(r, 350))
    return document.querySelector('textarea[aria-label="YAML output"]')?.value ?? null
  })()`)
  check(
    'JSON converts to YAML through the UI',
    typeof yamlOutput === 'string' && yamlOutput.includes('name: toolkit') && yamlOutput.includes('  - 1'),
    yamlOutput
  )

  const diffRows = await evaluate(`(async () => {
    location.hash = '#/diff-checker'
    await new Promise((r) => setTimeout(r, 500))
    const setValue = (label, value) => {
      const el = document.querySelector('textarea[aria-label="' + label + '"]')
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, value)
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }
    setValue('Original text', 'alpha\\nbeta')
    setValue('Changed text', 'alpha\\ngamma')
    await new Promise((r) => setTimeout(r, 150))
    ;[...document.querySelectorAll('button')].find((button) => button.textContent.trim() === 'Compare').click()
    await new Promise((r) => setTimeout(r, 350))
    return {
      added: document.querySelectorAll('.diff-row.diff-add').length,
      removed: document.querySelectorAll('.diff-row.diff-remove').length
    }
  })()`)
  check('diff checker highlights additions and removals', diffRows.added === 1 && diffRows.removed === 1, diffRows)

  const regex = await evaluate(`(async () => {
    location.hash = '#/regex-tester'
    await new Promise((r) => setTimeout(r, 500))
    return {
      cards: document.querySelectorAll('.match-card').length,
      marks: document.querySelectorAll('mark.regex-hit').length,
      error: document.querySelector('.callout-error')?.innerText ?? null,
      replacementValue: document.querySelector('input[aria-label="Replacement pattern"]')?.value ?? null,
      result: document.querySelector('pre[aria-label="Replacement result"]')?.textContent ?? null,
      footer:
        [...document.querySelectorAll('.panel-footer')]
          .map((el) => el.textContent)
          .find((text) => /replacement/.test(text)) ?? null
    }
  })()`)
  check('regex tester lists matches with highlights', regex.cards > 0 && regex.marks > 0 && !regex.error, regex)
  check(
    'regex tester previews replacements with capture references',
    regex.replacementValue === '$<user> [at] $<host>' &&
      typeof regex.result === 'string' &&
      regex.result.includes('dev [at] toolkit.local') &&
      Boolean(regex.footer?.includes('4 replacements')),
    regex
  )

  const entitiesOutput = await evaluate(`(async () => {
    location.hash = '#/html-entities'
    await new Promise((r) => setTimeout(r, 500))
    const el = document.querySelector('textarea[aria-label="Text to encode"]')
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, '<b>Tom & Jerry</b>')
    el.dispatchEvent(new Event('input', { bubbles: true }))
    await new Promise((r) => setTimeout(r, 300))
    return document.querySelector('textarea[aria-label="Conversion output"]')?.value ?? null
  })()`)
  check(
    'HTML entity encoder works through the UI',
    entitiesOutput === '&lt;b&gt;Tom &amp; Jerry&lt;/b&gt;',
    entitiesOutput
  )

  const sqlOutput = await evaluate(`(async () => {
    location.hash = '#/sql-formatter'
    await new Promise((r) => setTimeout(r, 600))
    const el = document.querySelector('textarea[aria-label="SQL input"]')
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(
      el,
      'select id, name from users where active = 1'
    )
    el.dispatchEvent(new Event('input', { bubbles: true }))
    await new Promise((r) => setTimeout(r, 400))
    return document.querySelector('textarea[aria-label="Formatted SQL output"]')?.value ?? null
  })()`)
  check(
    'SQL formatter formats queries through the UI',
    typeof sqlOutput === 'string' && sqlOutput.includes('SELECT') && sqlOutput.includes('WHERE'),
    sqlOutput
  )

  const savedHistory = await evaluate(`(async () => {
    const save = [...document.querySelectorAll('button')].find(
      (button) => button.textContent.trim() === 'Save'
    )
    save?.click()
    await new Promise((r) => setTimeout(r, 300))
    return {
      clicked: Boolean(save),
      toast: document.querySelector('.toast')?.textContent ?? null,
      labels: JSON.parse(localStorage.getItem('devkit:history') ?? '[]').map((entry) => entry.label)
    }
  })()`)
  check(
    'tools save outputs to the working set',
    savedHistory.clicked &&
      Boolean(savedHistory.toast?.includes('Saved')) &&
      savedHistory.labels.includes('Formatted SQL'),
    savedHistory
  )

  const historyPage = await evaluate(`(async () => {
    location.hash = '#/history'
    await new Promise((r) => setTimeout(r, 400))
    const page = {
      title: document.title,
      heading: document.querySelector('.history-page h1')?.textContent ?? null,
      navCount: document.querySelector('.nav-count')?.textContent ?? null,
      navItems: [...document.querySelectorAll('.nav-section-app .nav-item')].map((item) =>
        item.textContent.trim()
      ),
      entries: document.querySelectorAll('.history-entry').length,
      value: document.querySelector('.history-value')?.textContent ?? null
    }
    document.querySelector('button[aria-label="Pin saved output"]')?.click()
    await new Promise((r) => setTimeout(r, 250))
    return {
      ...page,
      pinned: JSON.parse(localStorage.getItem('devkit:history') ?? '[]')[0]?.pinned === true,
      pressed:
        document
          .querySelector('button[aria-label="Unpin saved output"]')
          ?.getAttribute('aria-pressed') === 'true'
    }
  })()`)
  check(
    'working set lists and pins saved outputs',
    historyPage.title === 'Working set · DevBench' &&
      historyPage.heading === 'Saved outputs' &&
      historyPage.navCount === '1' &&
      historyPage.entries === 1 &&
      Boolean(historyPage.value?.includes('SELECT')) &&
      historyPage.pinned === true &&
      historyPage.pressed === true,
    historyPage
  )

  const historyDelete = await evaluate(`(async () => {
    document.querySelector('button[aria-label="Delete saved output"]')?.click()
    await new Promise((r) => setTimeout(r, 300))
    return {
      empty: Boolean(document.querySelector('.history-empty')),
      navCount: document.querySelector('.nav-count')?.textContent ?? null,
      stored: JSON.parse(localStorage.getItem('devkit:history') ?? '[]').length
    }
  })()`)
  check(
    'working set entries can be removed',
    historyDelete.empty && historyDelete.navCount === null && historyDelete.stored === 0,
    historyDelete
  )

  const resavedHistory = await evaluate(`(async () => {
    location.hash = '#/sql-formatter'
    await new Promise((r) => setTimeout(r, 400))
    ;[...document.querySelectorAll('button')]
      .find((button) => button.textContent.trim() === 'Save')
      ?.click()
    await new Promise((r) => setTimeout(r, 300))
    return JSON.parse(localStorage.getItem('devkit:history') ?? '[]').length
  })()`)
  check('working set can be saved again', resavedHistory === 1, resavedHistory)

  const paletteHistory = await evaluate(`(async () => {
    location.hash = '#/home'
    await new Promise((r) => setTimeout(r, 300))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))
    await new Promise((r) => setTimeout(r, 300))
    const input = document.querySelector('input[aria-label="Command palette search"]')
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'working set')
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await new Promise((r) => setTimeout(r, 300))
    const option = [...document.querySelectorAll('.palette-item')].find((button) =>
      button.textContent.includes('Open working set')
    )
    option?.click()
    await new Promise((r) => setTimeout(r, 400))
    return { hasCommand: Boolean(option), hash: location.hash }
  })()`)
  check(
    'command palette opens the working set',
    paletteHistory.hasCommand && paletteHistory.hash === '#/history',
    paletteHistory
  )

  const colorOutputs = await evaluate(`(async () => {
    location.hash = '#/color-converter'
    await new Promise((r) => setTimeout(r, 600))
    const el = document.querySelector('input[aria-label="Color value"]')
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, '#ff0000')
    el.dispatchEvent(new Event('input', { bubbles: true }))
    await new Promise((r) => setTimeout(r, 300))
    return [...document.querySelectorAll('.output-value')].map((node) => node.textContent.trim())
  })()`)
  check(
    'color converter lists every format',
    colorOutputs.includes('#ff0000') &&
      colorOutputs.includes('rgb(255, 0, 0)') &&
      colorOutputs.some((value) => value.startsWith('oklch(0.628')),
    colorOutputs
  )

  const qrPreview = await evaluate(`(async () => {
    location.hash = '#/qr-generator'
    await new Promise((r) => setTimeout(r, 700))
    const image = document.querySelector('img[alt="QR code preview"]')
    return {
      src: image?.getAttribute('src')?.slice(0, 28) ?? null,
      meta: document.body.innerText.includes('modules'),
      downloadButtons: [...document.querySelectorAll('button')].filter((button) =>
        ['SVG', 'PNG'].includes(button.textContent.trim())
      ).length
    }
  })()`)
  check(
    'QR generator renders an offline preview with exports',
    typeof qrPreview.src === 'string' &&
      qrPreview.src.startsWith('data:image/svg+xml') &&
      qrPreview.meta === true &&
      qrPreview.downloadButtons === 2,
    qrPreview
  )

  const cron = await evaluate(`(async () => {
    location.hash = '#/cron-parser'
    await new Promise((r) => setTimeout(r, 600))
    const el = document.querySelector('input[aria-label="Cron expression"]')
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, '0 9 * * 1-5')
    el.dispatchEvent(new Event('input', { bubbles: true }))
    await new Promise((r) => setTimeout(r, 500))
    return {
      summary: document.querySelector('.cron-summary')?.textContent ?? '',
      runs: document.querySelectorAll('.cron-run-row').length,
      error: document.querySelector('.callout-error')?.innerText ?? null
    }
  })()`)
  check(
    'cron parser explains schedules and lists runs',
    cron.summary.includes('09:00') &&
      cron.summary.includes('Monday through Friday') &&
      cron.runs === 5 &&
      !cron.error,
    cron
  )

  const urlForm = await evaluate(`(async () => {
    location.hash = '#/url-encoder'
    await new Promise((r) => setTimeout(r, 600))
    const formButton = [...document.querySelectorAll('.segment')].find(
      (button) => button.textContent.trim() === 'Form body'
    )
    formButton.click()
    const input = document.querySelector('textarea[aria-label="URL input"]')
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(input, 'a b&c=d+e')
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await new Promise((r) => setTimeout(r, 300))
    const formOutput = document.querySelector('textarea[aria-label="URL output"]')?.value ?? null
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(
      input,
      'https://example.com/search?q=hello+world&tag=a%26b'
    )
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await new Promise((r) => setTimeout(r, 300))
    return {
      formOutput,
      params: document.querySelectorAll('.param-row').length,
      key: document.querySelector('.param-key')?.textContent ?? null,
      value: document.querySelector('.param-value')?.textContent ?? null
    }
  })()`)
  check('URL encoder supports form bodies', urlForm.formOutput === 'a+b%26c%3Dd%2Be', urlForm.formOutput)
  check(
    'URL encoder breaks down query parameters',
    urlForm.params === 2 && urlForm.key === 'q' && urlForm.value === 'hello world',
    urlForm
  )

  const palette = await evaluate(`(async () => {
    location.hash = '#/home'
    await new Promise((r) => setTimeout(r, 400))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))
    await new Promise((r) => setTimeout(r, 250))
    const dialog = document.querySelector('[role="dialog"][aria-label="Command palette"]')
    const input = dialog?.querySelector('input[aria-label="Command palette search"]')
    if (!input) return { open: false, items: [] }
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'jwt')
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await new Promise((r) => setTimeout(r, 250))
    const items = [...document.querySelectorAll('.palette-item')].map((el) => el.textContent.trim())
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    await new Promise((r) => setTimeout(r, 400))
    return { open: true, items, hash: location.hash, closed: !document.querySelector('.palette') }
  })()`)
  check(
    'command palette opens with Ctrl+K and navigates on Enter',
    palette.open &&
      palette.items.length >= 1 &&
      palette.items[0].includes('JWT') &&
      palette.hash === '#/jwt-decoder' &&
      palette.closed === true,
    palette
  )

  const favorite = await evaluate(`(async () => {
    await new Promise((r) => setTimeout(r, 400))
    const search = document.querySelector('.sidebar .search-box input')
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(search, '')
    search.dispatchEvent(new Event('input', { bubbles: true }))
    await new Promise((r) => setTimeout(r, 200))
    document.querySelector('.tool-actions .icon-btn')?.click()
    await new Promise((r) => setTimeout(r, 250))
    const titles = [...document.querySelectorAll('.nav-section-title')].map((el) => el.textContent.trim())
    const stored = JSON.parse(localStorage.getItem('devkit:favorites') ?? '[]')
    document.querySelector('.tool-actions .icon-btn')?.click()
    return { titles, stored }
  })()`)
  check(
    'starring a tool pins it to sidebar favorites',
    favorite.titles.includes('Favorites') && favorite.stored.includes('jwt-decoder'),
    favorite
  )

  const jwtVerify = await evaluate(`(async () => {
    location.hash = '#/jwt-decoder'
    await new Promise((r) => setTimeout(r, 500))
    const token =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
    const area = document.querySelector('textarea[aria-label="JWT token"]')
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(area, token)
    area.dispatchEvent(new Event('input', { bubbles: true }))
    await new Promise((r) => setTimeout(r, 350))
    const secret = document.querySelector('input[aria-label="JWT secret"]')
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(
      secret,
      'your-256-bit-secret'
    )
    secret.dispatchEvent(new Event('input', { bubbles: true }))
    await new Promise((r) => setTimeout(r, 250))
    ;[...document.querySelectorAll('button')]
      .find((button) => button.textContent.includes('Verify signature'))
      ?.click()
    await new Promise((r) => setTimeout(r, 800))
    return {
      success: document.querySelector('.callout-success')?.innerText ?? null,
      error: document.querySelector('.callout-error')?.innerText ?? null
    }
  })()`)
  check(
    'JWT verifies an HS256 signature locally',
    Boolean(jwtVerify.success?.includes('Signature verified')) && !jwtVerify.error,
    jwtVerify
  )

  const hashTool = await evaluate(`(async () => {
    location.hash = '#/hash-generator'
    await new Promise((r) => setTimeout(r, 500))
    const area = document.querySelector('textarea[aria-label="Text to hash"]')
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(area, 'abc')
    area.dispatchEvent(new Event('input', { bubbles: true }))
    await new Promise((r) => setTimeout(r, 500))
    const expected = document.querySelector('input[aria-label="Expected digest"]')
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(
      expected,
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    )
    expected.dispatchEvent(new Event('input', { bubbles: true }))
    await new Promise((r) => setTimeout(r, 300))
    return {
      digest: document.querySelector('.hash-value')?.textContent ?? '',
      match: document.querySelector('.compare-result.is-match')?.textContent ?? null
    }
  })()`)
  check(
    'hash generator compares an expected SHA-256 digest',
    hashTool.digest === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad' &&
      Boolean(hashTool.match?.includes('matches')),
    hashTool
  )

  const uuidTool = await evaluate(`(async () => {
    location.hash = '#/uuid-generator'
    await new Promise((r) => setTimeout(r, 500))
    ;[...document.querySelectorAll('.segment')]
      .find((button) => button.textContent.trim() === 'nanoid')
      ?.click()
    await new Promise((r) => setTimeout(r, 150))
    const count = document.querySelector('#uuid-count')
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(count, '3')
    count.dispatchEvent(new Event('input', { bubbles: true }))
    ;[...document.querySelectorAll('button')]
      .find((button) => button.textContent.trim() === 'Generate')
      ?.click()
    await new Promise((r) => setTimeout(r, 300))
    const nanoids = [...document.querySelectorAll('.uuid-value')].map((el) => el.textContent.trim())
    const name = document.querySelector('input[aria-label="Name to hash"]')
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(name, 'example.com')
    name.dispatchEvent(new Event('input', { bubbles: true }))
    ;[...document.querySelectorAll('button')]
      .find((button) => button.textContent.trim() === 'Add')
      ?.click()
    await new Promise((r) => setTimeout(r, 500))
    const namespaced = document.querySelector('.uuid-value')?.textContent.trim()
    return { nanoids, namespaced, count: document.querySelectorAll('.uuid-value').length }
  })()`)
  check(
    'UUID generator creates nanoids and namespaced v5 IDs',
    uuidTool.nanoids.length === 3 &&
      uuidTool.nanoids.every((value) => value.length === 21) &&
      uuidTool.namespaced === 'cfbff0d1-9375-5685-968c-48ce8b15ae17' &&
      uuidTool.count === 4,
    uuidTool
  )

  const timestampTool = await evaluate(`(async () => {
    location.hash = '#/timestamp-converter'
    await new Promise((r) => setTimeout(r, 500))
    const input = document.querySelector('input[aria-label="Timestamp or date"]')
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '1700000000')
    input.dispatchEvent(new Event('input', { bubbles: true }))
    const zone = document.querySelector('#time-zone')
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(zone, 'Asia/Tokyo')
    zone.dispatchEvent(new Event('change', { bubbles: true }))
    await new Promise((r) => setTimeout(r, 400))
    const outputs = document.querySelector('.output-list')?.innerText ?? ''
    const from = document.querySelector('#duration-from')
    const to = document.querySelector('#duration-to')
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(from, '1700000000')
    from.dispatchEvent(new Event('input', { bubbles: true }))
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(to, '1700086400')
    to.dispatchEvent(new Event('input', { bubbles: true }))
    await new Promise((r) => setTimeout(r, 300))
    const duration = document.querySelector('.duration-headline')?.textContent ?? ''
    return { outputs, duration }
  })()`)
  check(
    'timestamp converter applies time zones, ISO weeks, and durations',
    timestampTool.outputs.includes('2023-W46') &&
      timestampTool.outputs.includes('2023-11-15') &&
      timestampTool.duration.includes('1 day later'),
    timestampTool
  )

  const persistedInput = await evaluate(`(async () => {
    location.hash = '#/home'
    await new Promise((r) => setTimeout(r, 350))
    location.hash = '#/timestamp-converter'
    await new Promise((r) => setTimeout(r, 500))
    const input = document.querySelector('input[aria-label="Timestamp or date"]')
    return {
      value: input?.value ?? null,
      zone: document.querySelector('#time-zone')?.value ?? null
    }
  })()`)
  check(
    'tool inputs and options persist across navigation',
    persistedInput.value === '1700000000' && persistedInput.zone === 'Asia/Tokyo',
    persistedInput
  )

  const settings = await evaluate(`(async () => {
    location.hash = '#/home'
    await new Promise((r) => setTimeout(r, 400))
    document.body.dispatchEvent(
      new KeyboardEvent('keydown', { key: ',', ctrlKey: true, bubbles: true })
    )
    await new Promise((r) => setTimeout(r, 400))
    const shortcutHash = location.hash

    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))
    await new Promise((r) => setTimeout(r, 250))
    const input = document.querySelector('input[aria-label="Command palette search"]')
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'settings')
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await new Promise((r) => setTimeout(r, 250))
    const command = [...document.querySelectorAll('.palette-item')].find((el) =>
      el.textContent.includes('Open settings')
    )
    const commandVisible = Boolean(command)
    const hasKbd = Boolean(command?.querySelector('.palette-kbd'))
    command?.click()
    await new Promise((r) => setTimeout(r, 400))

    const cards = [...document.querySelectorAll('.theme-card')]
    const activeBefore =
      cards.find((card) => card.getAttribute('aria-pressed') === 'true')?.textContent.trim() ?? null
    cards.find((card) => card.textContent.includes('Cyber Blue'))?.click()
    await new Promise((r) => setTimeout(r, 300))

    return {
      shortcutHash,
      commandVisible,
      hasKbd,
      hash: location.hash,
      page: Boolean(document.querySelector('.settings-page')),
      cards: cards.length,
      activeBefore,
      theme: document.documentElement.dataset.theme,
      storedTheme: localStorage.getItem('devkit:theme'),
      metrics: [...document.querySelectorAll('.settings-metric-label')].map((el) =>
        el.textContent.trim()
      ),
      sidebar: [...document.querySelectorAll('.nav-section-app .nav-item')].some((item) =>
        item.textContent.includes('Settings')
      ),
      version: document.querySelector('.about-list dd')?.textContent ?? null
    }
  })()`)
  check('Ctrl+, opens settings', settings.shortcutHash === '#/settings', settings.shortcutHash)
  check(
    'palette exposes the settings command',
    settings.commandVisible && settings.hasKbd && settings.hash === '#/settings' && settings.page,
    settings
  )
  check(
    'settings lists themes, storage metrics, and about details',
    settings.cards === 6 &&
      settings.activeBefore?.includes('Arctic Frost') &&
      settings.metrics.includes('Tool inputs') &&
      settings.metrics.includes('Storage used') &&
      settings.sidebar === true &&
      /^v\d+\.\d+\.\d+$/.test(settings.version ?? ''),
    settings
  )
  check(
    'settings theme cards apply and persist the theme',
    settings.theme === 'cyber-blue' && settings.storedTheme === 'cyber-blue',
    { theme: settings.theme, storedTheme: settings.storedTheme }
  )

  const shortcuts = await evaluate(`(async () => {
    location.hash = '#/home'
    await new Promise((r) => setTimeout(r, 400))
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true }))
    await new Promise((r) => setTimeout(r, 300))
    const dialog = document.querySelector('[role="dialog"][aria-labelledby="shortcuts-title"]')
    const snapshot = {
      open: Boolean(dialog),
      modal: dialog?.getAttribute('aria-modal') ?? null,
      groups: dialog?.querySelectorAll('.shortcut-group').length ?? 0,
      rows: dialog?.querySelectorAll('.shortcut-row').length ?? 0,
      focused: document.activeElement?.getAttribute('aria-label') ?? null
    }
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await new Promise((r) => setTimeout(r, 250))
    return { ...snapshot, closed: !document.querySelector('.shortcuts-dialog') }
  })()`)
  check(
    'shortcuts guide opens with ? and closes with Escape',
    shortcuts.open &&
      shortcuts.modal === 'true' &&
      shortcuts.groups === 3 &&
      shortcuts.rows >= 6 &&
      shortcuts.focused === 'Close shortcuts' &&
      shortcuts.closed === true,
    shortcuts
  )

  const cleared = await evaluate(`(async () => {
    location.hash = '#/settings'
    await new Promise((r) => setTimeout(r, 500))
    const toolKeys = () =>
      Object.keys(localStorage).filter(
        (key) =>
          key.startsWith('devkit:') &&
          !['devkit:theme', 'devkit:favorites', 'devkit:recent', 'devkit:history'].includes(key)
      ).length
    const before = toolKeys()
    const themeBefore = localStorage.getItem('devkit:theme')
    const historyBefore = JSON.parse(localStorage.getItem('devkit:history') ?? '[]').length
    ;[...document.querySelectorAll('button')]
      .find((button) => button.textContent.trim() === 'Clear inputs')
      ?.click()
    await new Promise((r) => setTimeout(r, 400))
    return {
      before,
      after: toolKeys(),
      themeBefore,
      theme: localStorage.getItem('devkit:theme'),
      historyBefore,
      historyAfter: JSON.parse(localStorage.getItem('devkit:history') ?? '[]').length,
      toast: document.querySelector('.toast')?.textContent ?? null
    }
  })()`)
  check(
    'settings clears saved tool inputs without touching preferences',
    cleared.before > 0 &&
      cleared.after === 0 &&
      cleared.themeBefore === cleared.theme &&
      cleared.historyBefore === 1 &&
      cleared.historyAfter === 1 &&
      Boolean(cleared.toast?.includes('cleared')),
    cleared
  )

  const exported = await evaluate(`(async () => {
    location.hash = '#/settings'
    await new Promise((r) => setTimeout(r, 500))
    ;[...document.querySelectorAll('button')]
      .find((button) => button.textContent.includes('Export JSON'))
      ?.click()
    await new Promise((r) => setTimeout(r, 300))
    return { toast: [...document.querySelectorAll('.toast')].at(-1)?.textContent ?? null }
  })()`)
  check(
    'settings exports a JSON backup',
    Boolean(exported.toast?.includes('exported')),
    exported
  )

  await evaluate(`(() => {
    window.confirm = () => true
    const payload = JSON.stringify({
      kind: 'devbench-settings',
      version: 1,
      app: '0.8.0',
      createdAt: new Date().toISOString(),
      entries: {
        'devkit:theme': 'solar-flare',
        'devkit:favorites': '["hash-generator"]'
      }
    })
    const input = document.querySelector('input[aria-label="Import settings file"]')
    const transfer = new DataTransfer()
    transfer.items.add(new File([payload], 'settings.json', { type: 'application/json' }))
    input.files = transfer.files
    input.dispatchEvent(new Event('change', { bubbles: true }))
    return true
  })()`)
  await sleep(1800)
  const imported = await evaluate(`({
    theme: document.documentElement.dataset.theme,
    storedTheme: localStorage.getItem('devkit:theme'),
    favorites: localStorage.getItem('devkit:favorites'),
    favoritesSection: [...document.querySelectorAll('.nav-section-title')].some(
      (el) => el.textContent.trim() === 'Favorites'
    )
  })`)
  check(
    'settings import replaces saved data and reloads the app',
    imported.theme === 'solar-flare' &&
      imported.storedTheme === 'solar-flare' &&
      imported.favorites === '["hash-generator"]' &&
      imported.favoritesSection === true,
    imported
  )

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
