import { parseAllDocuments, stringify, type Document } from 'yaml'
import { validateJson } from './json'

export interface ConvertError {
  message: string
  line?: number
  column?: number
}

export type ConvertResult =
  | { ok: true; value: string }
  | { ok: false; error: ConvertError }

interface JsonToYamlOptions {
  indent?: 2 | 4
  sortKeys?: boolean
}

interface YamlToJsonOptions {
  indent?: number | string
  minify?: boolean
}

function toJsonValue(document: Document.Parsed): unknown {
  return document.toJS({ maxAliasCount: 100 })
}

export function jsonToYaml(input: string, options: JsonToYamlOptions = {}): ConvertResult {
  if (!input.trim()) return { ok: false, error: { message: 'Paste JSON to convert.' } }

  const validation = validateJson(input)
  if (!validation.ok) {
    return {
      ok: false,
      error: {
        message: validation.error.message,
        line: validation.error.line,
        column: validation.error.column
      }
    }
  }

  try {
    const parsed: unknown = JSON.parse(input)
    const value = stringify(parsed, {
      indent: options.indent ?? 2,
      lineWidth: 0,
      sortMapEntries: options.sortKeys ? true : undefined,
      aliasDuplicateObjects: false
    })
    return { ok: true, value }
  } catch (error) {
    return {
      ok: false,
      error: {
        message: error instanceof Error ? error.message : 'This JSON value cannot become YAML.'
      }
    }
  }
}

export function yamlToJson(input: string, options: YamlToJsonOptions = {}): ConvertResult {
  if (!input.trim()) return { ok: false, error: { message: 'Paste YAML to convert.' } }

  let documents: Document.Parsed[]
  try {
    documents = parseAllDocuments(input, { prettyErrors: true, strict: true })
  } catch (error) {
    return {
      ok: false,
      error: {
        message: error instanceof Error ? error.message : 'This YAML could not be parsed.'
      }
    }
  }

  const firstProblem = documents.flatMap((document) => document.errors)[0]
  if (firstProblem) {
    return {
      ok: false,
      error: {
        message: firstProblem.message.split('\n')[0].trim(),
        line: firstProblem.linePos?.[0]?.line,
        column: firstProblem.linePos?.[0]?.col
      }
    }
  }

  try {
    const values = documents.map(toJsonValue)
    const value = values.length > 1 ? values : (values[0] ?? null)
    const text = options.minify
      ? JSON.stringify(value)
      : JSON.stringify(value, null, options.indent ?? 2)

    return { ok: true, value: text }
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    return {
      ok: false,
      error: {
        message: /circular/i.test(message)
          ? 'YAML aliases create a circular reference that JSON cannot represent.'
          : 'This YAML value cannot be represented as JSON.'
      }
    }
  }
}
