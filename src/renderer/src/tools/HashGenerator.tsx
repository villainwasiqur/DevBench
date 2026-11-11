import { useEffect, useState, type ReactElement } from 'react'
import { Icon } from '../icons'
import { ToolPage } from '../components/ToolPage'
import { Button } from '../components/ui/Button'
import { CodeArea } from '../components/ui/CodeArea'
import { CopyButton } from '../components/ui/CopyButton'
import { FileDrop } from '../components/ui/FileDrop'
import { Callout, Panel } from '../components/ui/Panel'
import { Segmented } from '../components/ui/Segmented'
import { Toggle } from '../components/ui/Toggle'
import { useToast } from '../components/ui/Toast'
import { usePersistentState } from '../hooks/usePersistentState'
import { formatBytes } from '../lib/format'
import { textByteLength } from '../lib/base64'
import {
  digestBytes,
  digestMatches,
  digestText,
  hmacBytes,
  toBase64,
  toHex,
  type HashAlgorithm
} from '../lib/hash'
import { getTool } from './registry'

const ALGORITHMS = [
  { value: 'SHA-1', label: 'SHA-1', bits: 160 },
  { value: 'SHA-256', label: 'SHA-256', bits: 256 },
  { value: 'SHA-384', label: 'SHA-384', bits: 384 },
  { value: 'SHA-512', label: 'SHA-512', bits: 512 }
] as const

const MODES = [
  { value: 'text', label: 'Text' },
  { value: 'file', label: 'File' }
] as const

const OUTPUTS = [
  { value: 'hex', label: 'Hex' },
  { value: 'base64', label: 'Base64' }
] as const

type Mode = (typeof MODES)[number]['value']
type OutputFormat = (typeof OUTPUTS)[number]['value']

interface LoadedFile {
  name: string
  size: number
  bytes: Uint8Array<ArrayBuffer>
}

export default function HashGenerator(): ReactElement {
  const tool = getTool('hash-generator')!
  const { show } = useToast()
  const [mode, setMode] = usePersistentState<Mode>('hash:mode', 'text')
  const [algorithm, setAlgorithm] = usePersistentState<HashAlgorithm>('hash:algorithm', 'SHA-256')
  const [outputFormat, setOutputFormat] = usePersistentState<OutputFormat>('hash:output', 'hex')
  const [text, setText] = useState('')
  const [file, setFile] = useState<LoadedFile | null>(null)
  const [hmac, setHmac] = useState(false)
  const [hmacKey, setHmacKey] = useState('')
  const [expected, setExpected] = useState('')
  const [hex, setHex] = useState('')
  const [base64, setBase64] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const hasInput = mode === 'text' ? text.length > 0 : file !== null
    if (!hasInput) {
      setHex('')
      setBase64('')
      setError('')
      return
    }
    if (hmac && !hmacKey) {
      setHex('')
      setBase64('')
      setError('Enter an HMAC key to compute a keyed digest.')
      return
    }

    let active = true

    const hash = async (): Promise<void> => {
      try {
        const bytes = mode === 'text' ? new TextEncoder().encode(text) : file!.bytes
        const computed = hmac
          ? await hmacBytes(algorithm, hmacKey, bytes)
          : mode === 'text'
            ? await digestText(algorithm, text)
            : await digestBytes(algorithm, bytes)

        if (!active) return
        setHex(toHex(computed))
        setBase64(toBase64(computed))
        setError('')
      } catch (reason) {
        if (!active) return
        setHex('')
        setBase64('')
        setError(reason instanceof Error ? reason.message : 'Hashing failed.')
      }
    }

    void hash()

    return () => {
      active = false
    }
  }, [algorithm, text, file, mode, hmac, hmacKey])

  const algorithmInfo = ALGORITHMS.find((item) => item.value === algorithm) ?? ALGORITHMS[1]
  const digest = outputFormat === 'hex' ? hex : base64
  const compareReady = expected.trim().length > 0 && digest.length > 0
  const matches = compareReady && digestMatches(expected, digest)

  const loadFile = async (picked: File): Promise<void> => {
    try {
      const bytes = new Uint8Array(await picked.arrayBuffer())
      setFile({ name: picked.name, size: picked.size, bytes })
      show(`Loaded ${picked.name}`, 'success')
    } catch {
      show(`Could not read ${picked.name}.`, 'error')
    }
  }

  return (
    <ToolPage
      tool={tool}
      actions={
        <Button
          variant="secondary"
          icon={<Icon name="trash" size={14} />}
          onClick={() => {
            setText('')
            setFile(null)
            setExpected('')
          }}
          disabled={!text && !file && !expected}
        >
          Clear
        </Button>
      }
    >
      <div className="toolbar">
        <Segmented options={MODES} value={mode} onChange={setMode} ariaLabel="Hash input mode" />
        <span className="toolbar-label">Algorithm</span>
        <Segmented
          options={ALGORITHMS}
          value={algorithm}
          onChange={setAlgorithm}
          ariaLabel="Hash algorithm"
        />
        <span className="toolbar-label">Output</span>
        <Segmented
          options={OUTPUTS}
          value={outputFormat}
          onChange={setOutputFormat}
          ariaLabel="Digest encoding"
        />
        <div className="toolbar-group is-push">
          <span className="inline-note">
            <Icon name="shield" size={12} /> Computed locally
          </span>
        </div>
      </div>

      <div className="split">
        <div className="stack">
          {mode === 'text' ? (
            <CodeArea
              label="Text"
              ariaLabel="Text to hash"
              value={text}
              onChange={setText}
              placeholder="Type or paste text to generate a digest…"
              minHeight={300}
              wrap
              footerExtra={text ? <span>{formatBytes(textByteLength(text))}</span> : undefined}
            />
          ) : (
            <Panel
              title="File"
              footer={file ? `${file.name} · ${formatBytes(file.size)}` : 'Any file type up to 20 MB'}
            >
              <FileDrop
                accept="*"
                maxBytes={20 * 1024 * 1024}
                onFile={(picked) => void loadFile(picked)}
                onError={(message) => show(message, 'error')}
              >
                {({ open }) => (
                  <div className="file-hash-zone">
                    <Icon name="file-code" size={26} />
                    {file ? (
                      <>
                        <span className="file-hash-name">{file.name}</span>
                        <span className="field-hint">{formatBytes(file.size)}</span>
                      </>
                    ) : (
                      <span className="field-hint">
                        Drop a file here or choose one to hash its raw bytes.
                      </span>
                    )}
                    <Button variant="secondary" size="sm" onClick={open}>
                      Choose file
                    </Button>
                  </div>
                )}
              </FileDrop>
            </Panel>
          )}

          <Panel title="Keyed hash">
            <div className="stack-sm">
              <Toggle checked={hmac} onChange={setHmac} label="Use HMAC" />
              {hmac && (
                <input
                  className="text-input mono"
                  value={hmacKey}
                  onChange={(event) => setHmacKey(event.target.value)}
                  placeholder="Secret key for the HMAC"
                  aria-label="HMAC key"
                  spellCheck={false}
                />
              )}
              <span className="field-hint">
                HMAC mixes a secret key into the digest. Keys stay in this window and are never
                stored.
              </span>
            </div>
          </Panel>
        </div>

        <div className="stack">
          <Panel
            title={`${hmac ? 'HMAC-' : ''}${algorithm} digest`}
            actions={<CopyButton value={digest} />}
            footer={
              outputFormat === 'hex'
                ? `${algorithmInfo.bits} bits · ${digest.length} hex characters`
                : `${algorithmInfo.bits} bits · ${digest.length} Base64 characters`
            }
          >
            {digest ? (
              <code className="hash-value">{digest}</code>
            ) : (
              <span className="panel-placeholder">Start typing to generate a digest.</span>
            )}
          </Panel>

          <Panel title="Compare">
            <div className="stack-sm">
              <input
                className="text-input mono"
                value={expected}
                onChange={(event) => setExpected(event.target.value)}
                placeholder="Paste an expected digest"
                aria-label="Expected digest"
                spellCheck={false}
              />
              {compareReady ? (
                <span className={`compare-result${matches ? ' is-match' : ' is-mismatch'}`}>
                  <Icon name={matches ? 'check-circle' : 'alert'} size={14} />
                  {matches ? 'Digest matches' : 'Digest does not match'}
                </span>
              ) : (
                <span className="field-hint">
                  Paste a {outputFormat === 'hex' ? 'hex' : 'Base64'} digest above to compare it.
                </span>
              )}
            </div>
          </Panel>

          {error && (
            <Callout tone="error" title="Hashing failed">
              {error}
            </Callout>
          )}

          <Callout tone="info" title="One-way by design">
            Hash digests cannot be reversed. Changing a single character produces a completely
            different result, which is what makes hashes useful for integrity checks.
          </Callout>
        </div>
      </div>
    </ToolPage>
  )
}
