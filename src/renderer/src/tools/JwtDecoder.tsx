import { useEffect, useMemo, useState, type ReactElement, type ReactNode } from 'react'
import { Icon } from '../icons'
import { ToolPage } from '../components/ToolPage'
import { Button } from '../components/ui/Button'
import { CodeArea } from '../components/ui/CodeArea'
import { CopyButton } from '../components/ui/CopyButton'
import { Callout, Panel } from '../components/ui/Panel'
import { Segmented } from '../components/ui/Segmented'
import { useNow } from '../hooks/useNow'
import { usePersistentState } from '../hooks/usePersistentState'
import { encodeBase64Url } from '../lib/base64'
import { formatLocal, formatRelativeTime } from '../lib/format'
import { createJwt, decodeJwt, jwtClaimDate, verifyJwt } from '../lib/jwt'
import { getTool } from './registry'

type Mode = 'inspect' | 'create'
type VerifyState =
  | { kind: 'idle' }
  | { kind: 'running' }
  | { kind: 'ok'; message: string }
  | { kind: 'error'; message: string }

const CREATE_ALGORITHMS = [
  { value: 'HS256', label: 'HS256' },
  { value: 'HS384', label: 'HS384' },
  { value: 'HS512', label: 'HS512' }
] as const

function makeSampleToken(): string {
  const header = encodeBase64Url(
    JSON.stringify({ alg: 'HS256', typ: 'JWT', kid: 'devbench-demo' })
  )
  const payload = encodeBase64Url(
    JSON.stringify({
      iss: 'https://devbench.local',
      sub: 'user_1042',
      name: 'Ada Lovelace',
      role: 'admin',
      iat: 1767225600,
      exp: 2051222400
    })
  )
  return `${header}.${payload}.${encodeBase64Url('demo-signature-not-verified')}`
}

function renderClaimValue(key: string, value: unknown): ReactNode {
  if ((key === 'exp' || key === 'iat' || key === 'nbf') && typeof value === 'number') {
    return (
      <>
        {formatLocal(new Date(value * 1000))}
        <span className="claim-raw"> ({value})</span>
      </>
    )
  }
  if (typeof value === 'string') return value
  return JSON.stringify(value)
}

function metaDate(payload: Record<string, unknown>, key: string): { value: string; sub: string } {
  const date = jwtClaimDate(payload, key)
  if (!date) return { value: '—', sub: `No ${key} claim` }
  return { value: formatLocal(date), sub: String(payload[key]) }
}

export default function JwtDecoder(): ReactElement {
  const tool = getTool('jwt-decoder')!
  const [mode, setMode] = usePersistentState<Mode>('jwt:mode', 'inspect')
  const [token, setToken] = useState('')
  const [secret, setSecret] = useState('')
  const [publicKeys, setPublicKeys] = useState('')
  const [jwksUrl, setJwksUrl] = useState('')
  const [fetching, setFetching] = useState(false)
  const [verification, setVerification] = useState<VerifyState>({ kind: 'idle' })
  const [createAlgorithm, setCreateAlgorithm] = usePersistentState<'HS256' | 'HS384' | 'HS512'>(
    'jwt:algorithm',
    'HS256'
  )
  const [createSecret, setCreateSecret] = useState('')
  const [claims, setClaims] = useState(() =>
    JSON.stringify(
      { sub: 'user_1042', role: 'admin', iat: Math.floor(Date.now() / 1000) },
      null,
      2
    )
  )
  const [createdToken, setCreatedToken] = useState('')
  const [createError, setCreateError] = useState('')
  const [creating, setCreating] = useState(false)
  const now = useNow(30_000)

  const decoded = useMemo(() => {
    if (!token.trim()) return { kind: 'empty' as const }
    const result = decodeJwt(token)
    return result.ok
      ? { kind: 'ok' as const, token: result.token }
      : { kind: 'error' as const, message: result.error }
  }, [token])

  const algorithm = decoded.kind === 'ok' ? String(decoded.token.header.alg ?? '') : ''
  const usesHmac = algorithm.startsWith('HS')

  useEffect(() => {
    setVerification({ kind: 'idle' })
  }, [token, secret, publicKeys])

  const status = useMemo(() => {
    if (decoded.kind !== 'ok') return null
    const payload = decoded.token.payload
    const expiration = jwtClaimDate(payload, 'exp')
    const notBefore = jwtClaimDate(payload, 'nbf')

    if (notBefore && notBefore.getTime() > now.getTime()) {
      return {
        tone: 'warning',
        label: 'Not yet valid',
        detail: `Starts ${formatRelativeTime(notBefore, now)}`
      }
    }
    if (expiration) {
      if (expiration.getTime() <= now.getTime()) {
        return {
          tone: 'danger',
          label: 'Expired',
          detail: `Expired ${formatRelativeTime(expiration, now)}`
        }
      }
      return {
        tone: 'success',
        label: 'Active',
        detail: `Expires ${formatRelativeTime(expiration, now)}`
      }
    }
    return { tone: 'neutral', label: 'No expiry', detail: 'Token has no exp claim' }
  }, [decoded, now])

  const loadSample = (): void => setToken(makeSampleToken())

  const runVerification = async (): Promise<void> => {
    setVerification({ kind: 'running' })
    const result = await verifyJwt(token, {
      secret: usesHmac ? secret : undefined,
      jwks: usesHmac ? undefined : publicKeys
    })
    setVerification(
      result.ok
        ? {
            kind: 'ok',
            message: `Signature is valid (${result.algorithm}${
              result.kid ? ` · kid ${result.kid}` : ''
            }).`
          }
        : { kind: 'error', message: result.error }
    )
  }

  const fetchJwks = async (): Promise<void> => {
    if (!window.devkit?.net) {
      setVerification({ kind: 'error', message: 'JWKS fetching is not available in this window.' })
      return
    }
    setFetching(true)
    try {
      const result = await window.devkit.net.fetchJson(jwksUrl.trim())
      if (!result.ok) {
        setVerification({ kind: 'error', message: result.error })
        return
      }
      setPublicKeys(JSON.stringify(result.data, null, 2))
      setVerification({ kind: 'idle' })
    } finally {
      setFetching(false)
    }
  }

  const generateToken = async (): Promise<void> => {
    setCreating(true)
    setCreateError('')
    try {
      const result = await createJwt({
        algorithm: createAlgorithm,
        secret: createSecret,
        payload: claims
      })
      if (result.ok) {
        setCreatedToken(result.token)
      } else {
        setCreatedToken('')
        setCreateError(result.error)
      }
    } finally {
      setCreating(false)
    }
  }

  return (
    <ToolPage
      tool={tool}
      actions={
        mode === 'inspect' ? (
          <Button
            variant="secondary"
            icon={<Icon name="sparkles" size={15} />}
            onClick={loadSample}
          >
            Load example
          </Button>
        ) : undefined
      }
    >
      <div className="toolbar">
        <Segmented
          options={[
            { value: 'inspect', label: 'Inspect & verify' },
            { value: 'create', label: 'Create token' }
          ]}
          value={mode}
          onChange={setMode}
          ariaLabel="JWT mode"
        />
      </div>

      {mode === 'inspect' && (
        <>
      <CodeArea
        label="JWT token"
        ariaLabel="JWT token"
        value={token}
        onChange={setToken}
        placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0In0.signature"
        minHeight={150}
        wrap
        invalid={decoded.kind === 'error'}
        actions={
          <>
            <CopyButton value={token} label="Copy token" />
            <Button
              variant="ghost"
              size="sm"
              icon={<Icon name="trash" size={13} />}
              onClick={() => setToken('')}
              disabled={!token}
            >
              Clear
            </Button>
          </>
        }
        footerExtra={
          <span className="inline-note">
            <Icon name="lock" size={11} /> Decoded locally
          </span>
        }
      />

      {decoded.kind === 'error' && (
        <Callout tone="error" title="Could not decode token">
          {decoded.message}
        </Callout>
      )}

      {decoded.kind === 'ok' && status && (
        <>
          <div className="meta-grid">
            <div className="meta-card">
              <span className="meta-label">Status</span>
              <span className={`status-value status-${status.tone}`}>{status.label}</span>
              <span className="meta-sub">{status.detail}</span>
            </div>
            <div className="meta-card">
              <span className="meta-label">Algorithm</span>
              <span className="meta-value mono">{String(decoded.token.header.alg ?? '—')}</span>
              <span className="meta-sub">Type: {String(decoded.token.header.typ ?? '—')}</span>
            </div>
            <div className="meta-card">
              <span className="meta-label">Issued at</span>
              <span className="meta-value meta-value-sm">
                {metaDate(decoded.token.payload, 'iat').value}
              </span>
              <span className="meta-sub">{metaDate(decoded.token.payload, 'iat').sub}</span>
            </div>
            <div className="meta-card">
              <span className="meta-label">Expires</span>
              <span className="meta-value meta-value-sm">
                {metaDate(decoded.token.payload, 'exp').value}
              </span>
              <span className="meta-sub">{metaDate(decoded.token.payload, 'exp').sub}</span>
            </div>
          </div>

          <div className="split">
            <CodeArea
              label="Header"
              ariaLabel="Decoded JWT header"
              value={JSON.stringify(decoded.token.header, null, 2)}
              readOnly
              wrap
              minHeight={210}
              actions={<CopyButton value={JSON.stringify(decoded.token.header, null, 2)} />}
            />
            <CodeArea
              label="Payload"
              ariaLabel="Decoded JWT payload"
              value={JSON.stringify(decoded.token.payload, null, 2)}
              readOnly
              wrap
              minHeight={210}
              actions={<CopyButton value={JSON.stringify(decoded.token.payload, null, 2)} />}
            />
          </div>

          <div className="split">
            <Panel title="Claims">
              <div className="claims">
                {Object.entries(decoded.token.payload).map(([key, value]) => (
                  <div className="claim-row" key={key}>
                    <span className="claim-key">{key}</span>
                    <span className="claim-value">{renderClaimValue(key, value)}</span>
                  </div>
                ))}
              </div>
            </Panel>

            <div className="stack">
              <Panel
                title="Signature"
                actions={<CopyButton value={decoded.token.signature} label="Copy signature" />}
                footer="Base64URL signature segment. Verify it below with a secret or public key."
              >
                <code className="signature-value">
                  {decoded.token.signature || 'No signature segment'}
                </code>
              </Panel>

              <Panel title="Verify signature">
                {usesHmac || !algorithm ? (
                  <div className="stack-sm">
                    <label className="field-label" htmlFor="jwt-secret">
                      HMAC secret
                    </label>
                    <input
                      id="jwt-secret"
                      className="text-input mono"
                      value={secret}
                      onChange={(event) => setSecret(event.target.value)}
                      placeholder="Secret used to sign this token"
                      aria-label="JWT secret"
                      spellCheck={false}
                    />
                    <span className="field-hint">
                      Checked with Web Crypto in this window. The secret is never stored.
                    </span>
                  </div>
                ) : (
                  <div className="stack-sm">
                    <label className="field-label" htmlFor="jwt-public-key">
                      Public key (JWK or JWKS)
                    </label>
                    <textarea
                      id="jwt-public-key"
                      className="text-input mono jwt-key-input"
                      value={publicKeys}
                      onChange={(event) => setPublicKeys(event.target.value)}
                      placeholder='{"kty":"RSA","n":"…","e":"AQAB"}'
                      aria-label="JWT public key"
                      spellCheck={false}
                      rows={4}
                    />
                    <div className="jwks-row">
                      <input
                        className="text-input"
                        value={jwksUrl}
                        onChange={(event) => setJwksUrl(event.target.value)}
                        placeholder="https://issuer.example/.well-known/jwks.json"
                        aria-label="JWKS URL"
                        spellCheck={false}
                      />
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => void fetchJwks()}
                        disabled={fetching || !jwksUrl.trim()}
                      >
                        {fetching ? 'Fetching…' : 'Fetch JWKS'}
                      </Button>
                    </div>
                    <span className="field-hint">
                      Fetches once from the URL you enter, over HTTPS only. Nothing else leaves the
                      app.
                    </span>
                  </div>
                )}

                <div className="verify-actions">
                  <Button
                    variant="primary"
                    icon={<Icon name="shield" size={14} />}
                    onClick={() => void runVerification()}
                    disabled={
                      verification.kind === 'running' ||
                      (usesHmac ? !secret : !publicKeys.trim())
                    }
                  >
                    {verification.kind === 'running' ? 'Verifying…' : 'Verify signature'}
                  </Button>
                </div>

                {verification.kind === 'ok' && (
                  <Callout tone="success" title="Signature verified">
                    {verification.message}
                  </Callout>
                )}
                {verification.kind === 'error' && (
                  <Callout tone="error" title="Verification failed">
                    {verification.message}
                  </Callout>
                )}
              </Panel>
            </div>
          </div>
        </>
      )}

      {decoded.kind === 'empty' && (
        <Callout tone="info" title="Nothing leaves this app">
          Paste a JWT above to inspect its header and claims. You can also verify the signature
          with an HMAC secret or a public JWK — all checks happen on your machine.
        </Callout>
      )}
        </>
      )}

      {mode === 'create' && (
        <>
          <div className="toolbar">
            <span className="toolbar-label">Algorithm</span>
            <Segmented
              options={CREATE_ALGORITHMS}
              value={createAlgorithm}
              onChange={setCreateAlgorithm}
              ariaLabel="Signing algorithm"
            />
            <div className="toolbar-group is-push">
              <span className="inline-note">
                <Icon name="lock" size={12} /> Signed locally
              </span>
            </div>
          </div>

          <div className="split">
            <div className="stack">
              <Panel title="Signing secret">
                <div className="stack-sm">
                  <input
                    className="text-input mono"
                    value={createSecret}
                    onChange={(event) => setCreateSecret(event.target.value)}
                    placeholder="Secret used to sign the token"
                    aria-label="Signing secret"
                    spellCheck={false}
                  />
                  <span className="field-hint">
                    Only HMAC algorithms are offered for local signing. RS/ES signing requires a
                    private key and is not supported yet.
                  </span>
                </div>
              </Panel>

              <CodeArea
                label="Claims"
                ariaLabel="JWT claims"
                value={claims}
                onChange={setClaims}
                minHeight={240}
                wrap
                invalid={Boolean(createError)}
              />
            </div>

            <div className="stack">
              <Panel
                title="Signed token"
                actions={<CopyButton value={createdToken} label="Copy token" />}
                footer={
                  createdToken
                    ? `${createdToken.length} characters`
                    : 'Generate to sign the claims.'
                }
              >
                {createdToken ? (
                  <code className="signature-value jwt-token-output">{createdToken}</code>
                ) : (
                  <span className="panel-placeholder">Your signed token appears here.</span>
                )}
              </Panel>

              {createError && (
                <Callout tone="error" title="Could not create token">
                  {createError}
                </Callout>
              )}

              <Button
                variant="primary"
                icon={<Icon name="sparkles" size={14} />}
                onClick={() => void generateToken()}
                disabled={creating || !createSecret}
              >
                {creating ? 'Signing…' : 'Generate token'}
              </Button>

              <Callout tone="info" title="For local testing">
                Tokens are signed in this window with Web Crypto. Nothing is transmitted, and
                secrets are never written to storage.
              </Callout>
            </div>
          </div>
        </>
      )}
    </ToolPage>
  )
}
