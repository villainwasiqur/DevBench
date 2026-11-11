import type { IconName } from '../icons'

export const CATEGORIES = ['Data', 'Encoding', 'Security', 'Generators', 'Utilities'] as const

export type ToolCategory = (typeof CATEGORIES)[number]
export type ToolStatus = 'ready' | 'planned'

export interface ToolDef {
  id: string
  name: string
  description: string
  category: ToolCategory
  icon: IconName
  keywords: string[]
  status: ToolStatus
}

const TOOL_LIST: ToolDef[] = [
  {
    id: 'json-formatter',
    name: 'JSON Formatter',
    description: 'Format, validate, sort, and minify JSON with clear error locations.',
    category: 'Data',
    icon: 'braces',
    keywords: ['json', 'format', 'beautify', 'prettify', 'minify', 'validate', 'pretty'],
    status: 'ready'
  },
  {
    id: 'json-yaml',
    name: 'JSON ↔ YAML',
    description: 'Convert configuration between JSON and YAML, with anchors and multi-doc support.',
    category: 'Data',
    icon: 'layers',
    keywords: ['json', 'yaml', 'yml', 'convert', 'config'],
    status: 'ready'
  },
  {
    id: 'sql-formatter',
    name: 'SQL Formatter',
    description: 'Format SQL with dialect-aware keywords, casing, and indentation.',
    category: 'Data',
    icon: 'database',
    keywords: ['sql', 'query', 'format', 'database', 'postgres', 'mysql', 'sqlite'],
    status: 'ready'
  },
  {
    id: 'diff-checker',
    name: 'Diff Checker',
    description: 'Compare two text blocks line by line with additions and removals highlighted.',
    category: 'Data',
    icon: 'diff',
    keywords: ['diff', 'compare', 'text', 'changes', 'merge'],
    status: 'ready'
  },
  {
    id: 'base64',
    name: 'Base64 Encoder / Decoder',
    description: 'Encode and decode Base64 with UTF-8 and URL-safe support.',
    category: 'Encoding',
    icon: 'file-code',
    keywords: ['base64', 'encode', 'decode', 'b64', 'url safe'],
    status: 'ready'
  },
  {
    id: 'url-encoder',
    name: 'URL Encoder / Decoder',
    description: 'Encode or decode URLs, form bodies, and query components with a parameter breakdown.',
    category: 'Encoding',
    icon: 'link',
    keywords: ['url', 'uri', 'encode', 'decode', 'percent', 'query', 'form', 'urlencoded', 'params'],
    status: 'ready'
  },
  {
    id: 'html-entities',
    name: 'HTML Entities',
    description: 'Encode and decode named and numeric HTML entities.',
    category: 'Encoding',
    icon: 'code',
    keywords: ['html', 'entities', 'escape', 'unescape', 'encode', 'decode'],
    status: 'ready'
  },
  {
    id: 'jwt-decoder',
    name: 'JWT Decoder',
    description: 'Inspect JWTs, verify HS/RS/ES signatures, and create signed tokens locally.',
    category: 'Security',
    icon: 'key',
    keywords: [
      'jwt',
      'token',
      'jose',
      'claims',
      'auth',
      'decode',
      'verify',
      'signature',
      'hs256',
      'rs256',
      'es256',
      'jwks'
    ],
    status: 'ready'
  },
  {
    id: 'hash-generator',
    name: 'Hash Generator',
    description: 'Hash text or files with SHA digests and HMAC keys, then verify them.',
    category: 'Security',
    icon: 'hash',
    keywords: [
      'hash',
      'sha',
      'digest',
      'checksum',
      'sha256',
      'sha512',
      'hmac',
      'file hash',
      'base64',
      'compare'
    ],
    status: 'ready'
  },
  {
    id: 'regex-tester',
    name: 'Regex Tester',
    description: 'Test patterns against sample text with live highlights and capture groups.',
    category: 'Security',
    icon: 'regex',
    keywords: ['regex', 'regexp', 'pattern', 'match', 'test'],
    status: 'ready'
  },
  {
    id: 'uuid-generator',
    name: 'UUID Generator',
    description: 'Generate UUID v4/v7, ULID, nanoid, and namespaced IDs with TXT, CSV, or JSON export.',
    category: 'Generators',
    icon: 'fingerprint',
    keywords: [
      'uuid',
      'guid',
      'random',
      'identifier',
      'v4',
      'v7',
      'ulid',
      'nanoid',
      'v3',
      'v5',
      'namespaced',
      'export'
    ],
    status: 'ready'
  },
  {
    id: 'qr-generator',
    name: 'QR Code Generator',
    description: 'Turn text or links into QR codes and export them as SVG or PNG.',
    category: 'Generators',
    icon: 'qr',
    keywords: ['qr', 'code', 'barcode', 'link', 'generate', 'svg', 'png'],
    status: 'ready'
  },
  {
    id: 'timestamp-converter',
    name: 'Timestamp Converter',
    description: 'Convert timestamps and dates across time zones with custom formats and durations.',
    category: 'Utilities',
    icon: 'clock',
    keywords: [
      'timestamp',
      'unix',
      'epoch',
      'date',
      'time',
      'iso',
      'timezone',
      'duration',
      'week'
    ],
    status: 'ready'
  },
  {
    id: 'cron-parser',
    name: 'Cron Parser',
    description: 'Explain cron expressions in plain English and preview the next runs.',
    category: 'Utilities',
    icon: 'calendar-clock',
    keywords: ['cron', 'schedule', 'crontab', 'expression', 'next run'],
    status: 'ready'
  },
  {
    id: 'color-converter',
    name: 'Color Converter',
    description: 'Convert between HEX, RGB, HSL, and OKLCH with alpha support.',
    category: 'Utilities',
    icon: 'palette',
    keywords: ['color', 'colour', 'hex', 'rgb', 'hsl', 'oklch', 'convert'],
    status: 'ready'
  }
]

export const TOOLS: readonly ToolDef[] = TOOL_LIST
export const READY_TOOLS: readonly ToolDef[] = TOOL_LIST.filter((tool) => tool.status === 'ready')
export const PLANNED_TOOLS: readonly ToolDef[] = TOOL_LIST.filter(
  (tool) => tool.status === 'planned'
)

export function getTool(id: string): ToolDef | undefined {
  return TOOL_LIST.find((tool) => tool.id === id)
}

export function toolsInCategory(category: ToolCategory): readonly ToolDef[] {
  return TOOL_LIST.filter((tool) => tool.category === category)
}
