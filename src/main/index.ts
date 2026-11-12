import {
  app,
  BrowserWindow,
  clipboard,
  ipcMain,
  Menu,
  session,
  shell,
  type IpcMainEvent,
  type IpcMainInvokeEvent
} from 'electron'
import { join } from 'node:path'

const isDev = !app.isPackaged
const rendererUrl = process.env['ELECTRON_RENDERER_URL']

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    show: true,
    frame: false,
    backgroundColor: '#0a0e14',
    title: 'DevBench',
    icon: isDev ? join(app.getAppPath(), 'build/icon.png') : undefined,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false
    }
  })

  mainWindow = win

  win.webContents.on('preload-error', (_event, preloadPath, error) => {
    console.error(`Unable to load preload script at ${preloadPath}:`, error)
  })
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null
  })
  win.on('maximize', () => win.webContents.send('window:maximized-changed', true))
  win.on('unmaximize', () => win.webContents.send('window:maximized-changed', false))

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) void shell.openExternal(url)
    return { action: 'deny' }
  })

  win.webContents.on('will-navigate', (event, url) => {
    if (url !== win.webContents.getURL()) event.preventDefault()
  })

  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return
    const key = input.key.toLowerCase()

    if (key === 'f12' || (input.control && input.shift && key === 'i')) {
      win.webContents.toggleDevTools()
      event.preventDefault()
    }

    if (isDev && (key === 'f5' || (input.control && key === 'r'))) {
      win.webContents.reload()
      event.preventDefault()
    }
  })

  if (isDev && rendererUrl) {
    void win.loadURL(rendererUrl)
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function windowFrom(event: IpcMainEvent | IpcMainInvokeEvent): BrowserWindow | null {
  return BrowserWindow.fromWebContents(event.sender)
}

function registerIpcHandlers(): void {
  ipcMain.on('window:minimize', (event) => windowFrom(event)?.minimize())
  ipcMain.on('window:toggle-maximize', (event) => {
    const win = windowFrom(event)
    if (!win) return
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
  })
  ipcMain.on('window:close', (event) => windowFrom(event)?.close())
  ipcMain.handle('window:is-maximized', (event) => windowFrom(event)?.isMaximized() ?? false)
  ipcMain.handle('app:version', () => app.getVersion())
  ipcMain.handle('clipboard:write', (_event, text: unknown) => {
    if (typeof text !== 'string') return false
    clipboard.writeText(text)
    return true
  })
  ipcMain.handle('net:fetch-json', async (_event, rawUrl: unknown) => {
    if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
      return { ok: false, error: 'Enter a JWKS URL.' }
    }

    let url: URL
    try {
      url = new URL(rawUrl.trim())
    } catch {
      return { ok: false, error: 'Enter a valid HTTPS URL.' }
    }
    if (url.protocol !== 'https:') {
      return { ok: false, error: 'Only HTTPS URLs are allowed.' }
    }

    try {
      const response = await fetch(url, {
        headers: { accept: 'application/json' },
        redirect: 'follow',
        signal: AbortSignal.timeout(8000)
      })
      if (!response.ok) {
        return { ok: false, error: `The server returned HTTP ${response.status}.` }
      }
      if (!response.url.startsWith('https://')) {
        return { ok: false, error: 'The request redirected outside HTTPS.' }
      }

      const text = await response.text()
      if (text.length > 512 * 1024) {
        return { ok: false, error: 'The JWKS document is too large (limit 512 KB).' }
      }

      try {
        return { ok: true, data: JSON.parse(text) }
      } catch {
        return { ok: false, error: 'The response is not valid JSON.' }
      }
    } catch (reason) {
      return {
        ok: false,
        error: reason instanceof Error ? reason.message : 'The request failed.'
      }
    }
  })
}

const hasSingleInstanceLock = app.requestSingleInstanceLock()

if (!hasSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })

  app.on('web-contents-created', (_event, contents) => {
    contents.on('will-attach-webview', (event) => {
      event.preventDefault()
    })
  })

  app.whenReady().then(() => {
    app.setAppUserModelId('com.anonymousvillain.devbench')
    Menu.setApplicationMenu(null)
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => {
      callback(false)
    })
    session.defaultSession.setPermissionCheckHandler(() => false)

    registerIpcHandlers()
    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
