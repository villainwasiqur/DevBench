export type UrlMode = 'encode' | 'decode'
export type UrlScope = 'component' | 'form' | 'url'

export type UrlConvertResult = { ok: true; output: string } | { ok: false; error: string }

export function convertUrl(value: string, mode: UrlMode, scope: UrlScope): UrlConvertResult {
  if (!value) return { ok: true, output: '' }

  if (mode === 'encode') {
    if (scope === 'url') return { ok: true, output: encodeURI(value) }
    const encoded = encodeURIComponent(value)
    return { ok: true, output: scope === 'form' ? encoded.replace(/%20/g, '+') : encoded }
  }

  try {
    if (scope === 'url') return { ok: true, output: decodeURI(value) }
    if (scope === 'form') {
      return { ok: true, output: decodeURIComponent(value.replace(/\+/g, ' ')) }
    }
    return { ok: true, output: decodeURIComponent(value) }
  } catch {
    return {
      ok: false,
      error: 'Malformed percent-encoding — check for incomplete sequences like a lone “%”.'
    }
  }
}

export interface QueryParam {
  key: string
  value: string
  raw: string
  hasValue: boolean
}

export type QueryParseResult =
  | {
      ok: true
      base: string
      hash: string
      params: QueryParam[]
      truncated: boolean
    }
  | { ok: false; error: string }

export const MAX_QUERY_PARAMS = 200

export function parseQueryParams(input: string): QueryParseResult {
  const trimmed = input.trim()
  if (!trimmed) {
    return { ok: true, base: '', hash: '', params: [], truncated: false }
  }

  let rest = trimmed
  let hash = ''
  const hashIndex = rest.indexOf('#')
  if (hashIndex !== -1) {
    hash = rest.slice(hashIndex + 1)
    rest = rest.slice(0, hashIndex)
  }

  let base = ''
  const queryIndex = rest.indexOf('?')
  if (queryIndex !== -1) {
    base = rest.slice(0, queryIndex)
    rest = rest.slice(queryIndex + 1)
  }

  const segments = rest.split('&').filter((segment) => segment !== '')
  const params: QueryParam[] = []

  for (let index = 0; index < segments.length && params.length < MAX_QUERY_PARAMS; index += 1) {
    const segment = segments[index]
    const equals = segment.indexOf('=')
    const rawKey = equals === -1 ? segment : segment.slice(0, equals)
    const rawValue = equals === -1 ? '' : segment.slice(equals + 1)

    try {
      params.push({
        key: decodeURIComponent(rawKey.replace(/\+/g, ' ')),
        value: decodeURIComponent(rawValue.replace(/\+/g, ' ')),
        raw: segment,
        hasValue: equals !== -1
      })
    } catch {
      return {
        ok: false,
        error: `Parameter ${index + 1} has malformed percent-encoding.`
      }
    }
  }

  return { ok: true, base, hash, params, truncated: segments.length > MAX_QUERY_PARAMS }
}
