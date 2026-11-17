import { useMemo, type ReactElement } from 'react'
import { Icon } from '../icons'
import { ToolPage } from '../components/ToolPage'
import { Button } from '../components/ui/Button'
import { CodeArea } from '../components/ui/CodeArea'
import { Callout, Panel } from '../components/ui/Panel'
import { Segmented } from '../components/ui/Segmented'
import { useToast } from '../components/ui/Toast'
import { usePersistentState } from '../hooks/usePersistentState'
import {
  createQr,
  QR_ECC_LEVELS,
  qrToDataUrl,
  qrToSvg,
  type QrEcc,
  type QrMatrix
} from '../lib/qr'
import { getTool } from './registry'

type PngSize = '256' | '512' | '1024'

const PNG_SIZES: ReadonlyArray<{ value: PngSize; label: string }> = [
  { value: '256', label: '256 px' },
  { value: '512', label: '512 px' },
  { value: '1024', label: '1024 px' }
]

const SAMPLE = 'https://github.com/villainwasiqur/DevBench'

function triggerDownload(href: string, filename: string): void {
  const anchor = document.createElement('a')
  anchor.href = href
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}

function renderPng(matrix: QrMatrix, pixels: number): string | null {
  const canvas = document.createElement('canvas')
  canvas.width = pixels
  canvas.height = pixels
  const context = canvas.getContext('2d')
  if (!context) return null

  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, pixels, pixels)
  context.fillStyle = '#0b0b0b'

  const cell = pixels / matrix.size
  for (let row = 0; row < matrix.size; row += 1) {
    for (let column = 0; column < matrix.size; column += 1) {
      if (!matrix.modules[row][column]) continue
      context.fillRect(
        Math.floor(column * cell),
        Math.floor(row * cell),
        Math.ceil(cell),
        Math.ceil(cell)
      )
    }
  }

  return canvas.toDataURL('image/png')
}

export default function QrGenerator(): ReactElement {
  const tool = getTool('qr-generator')!
  const { show } = useToast()
  const [text, setText] = usePersistentState('qr-generator:text', SAMPLE)
  const [ecc, setEcc] = usePersistentState<QrEcc>('qr-generator:ecc', 'M')
  const [pngSize, setPngSize] = usePersistentState<PngSize>('qr-generator:pngSize', '512')

  const qr = useMemo(() => createQr(text, { ecc }), [text, ecc])
  const previewUrl = useMemo(
    () => (qr.ok ? qrToDataUrl(qrToSvg(qr.matrix, { pixelSize: 16 })) : ''),
    [qr]
  )

  const matrix = qr.ok ? qr.matrix : null
  const moduleCount = matrix ? 17 + 4 * (matrix.version - 1) : 0

  const downloadSvg = (): void => {
    if (!qr.ok) return
    triggerDownload(qrToDataUrl(qrToSvg(qr.matrix, { pixelSize: 16 })), 'qr-code.svg')
    show('SVG download started', 'success')
  }

  const downloadPng = (): void => {
    if (!qr.ok) return
    const png = renderPng(qr.matrix, Number(pngSize))
    if (!png) {
      show('PNG export is unavailable in this window', 'error')
      return
    }
    triggerDownload(png, 'qr-code.png')
    show(`${pngSize} px PNG download started`, 'success')
  }

  return (
    <ToolPage
      tool={tool}
      actions={
        <Button
          variant="secondary"
          icon={<Icon name="sparkles" size={15} />}
          onClick={() => setText(SAMPLE)}
        >
          Load example
        </Button>
      }
    >
      <div className="toolbar">
        <div className="toolbar-group">
          <span className="toolbar-label">Error correction</span>
          <Segmented options={QR_ECC_LEVELS} value={ecc} onChange={setEcc} ariaLabel="Error correction level" />
        </div>
        <div className="toolbar-group">
          <span className="toolbar-label">PNG size</span>
          <Segmented options={PNG_SIZES} value={pngSize} onChange={setPngSize} ariaLabel="PNG export size" />
        </div>
      </div>

      <div className="split">
        <Panel
          title="Content"
          footer={
            matrix
              ? `Version ${matrix.version} · ${moduleCount} × ${moduleCount} modules · ECC ${matrix.ecc}`
              : 'Waiting for valid content'
          }
        >
          <CodeArea
            label="Text or URL"
            ariaLabel="QR content"
            value={text}
            onChange={setText}
            placeholder="Type a URL, message, Wi-Fi details, or any text…"
            minHeight={220}
            wrap
            invalid={!qr.ok}
            actions={
              <Button
                variant="ghost"
                size="sm"
                icon={<Icon name="trash" size={13} />}
                onClick={() => setText('')}
                disabled={!text}
              >
                Clear
              </Button>
            }
            footerExtra={<span>{text.trim().length.toLocaleString()} / 2,000 chars</span>}
          />
          <span className="field-hint">
            A four-module quiet zone is included so scanners can lock on reliably. Longer content
            needs a larger version automatically.
          </span>
        </Panel>

        <Panel
          title="Preview"
          actions={
            <div className="qr-actions">
              <Button
                variant="secondary"
                size="sm"
                icon={<Icon name="download" size={14} />}
                onClick={downloadSvg}
                disabled={!qr.ok}
              >
                SVG
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={<Icon name="download" size={14} />}
                onClick={downloadPng}
                disabled={!qr.ok}
              >
                PNG
              </Button>
            </div>
          }
        >
          {qr.ok ? (
            <div className="qr-preview">
              <img src={previewUrl} alt="QR code preview" width={280} height={280} />
              <div className="qr-meta">
                <span className="pill pill-muted">Version {qr.matrix.version}</span>
                <span className="pill pill-muted">ECC {ecc}</span>
                <span className="pill pill-muted">{text.trim().length} chars</span>
              </div>
            </div>
          ) : (
            <span className="panel-placeholder">A valid QR code preview appears here.</span>
          )}
        </Panel>
      </div>

      {!qr.ok && (
        <Callout tone="error" title="Could not generate this QR code">
          {qr.error}
        </Callout>
      )}

      <Callout tone="info" title="Generated entirely offline">
        Encoding happens on this device with no network requests. Error correction lets scanners
        recover data from damaged codes: higher levels survive more damage but hold less text.
      </Callout>
    </ToolPage>
  )
}
