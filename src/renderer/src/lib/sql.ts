import { formatDialect, mysql, postgresql, sql, sqlite, type DialectOptions } from 'sql-formatter'

export type SqlDialect = 'standard' | 'postgresql' | 'mysql' | 'sqlite'
export type SqlKeywordCase = 'upper' | 'lower' | 'preserve'

export interface SqlFormatOptions {
  dialect: SqlDialect
  keywordCase: SqlKeywordCase
  tabWidth: 2 | 4
}

export const SQL_DIALECTS: ReadonlyArray<{ value: SqlDialect; label: string }> = [
  { value: 'standard', label: 'Standard SQL' },
  { value: 'postgresql', label: 'PostgreSQL' },
  { value: 'mysql', label: 'MySQL' },
  { value: 'sqlite', label: 'SQLite' }
]

const DIALECTS: Record<SqlDialect, DialectOptions> = {
  standard: sql,
  postgresql,
  mysql,
  sqlite
}

export const MAX_SQL_LENGTH = 200_000

export type SqlResult = { ok: true; output: string } | { ok: false; error: string }

export function formatSql(input: string, options: SqlFormatOptions): SqlResult {
  if (!input.trim()) return { ok: true, output: '' }
  if (input.length > MAX_SQL_LENGTH) {
    return {
      ok: false,
      error: `Keep queries under ${MAX_SQL_LENGTH.toLocaleString()} characters. For larger files, format them in chunks.`
    }
  }

  try {
    const output = formatDialect(input, {
      dialect: DIALECTS[options.dialect],
      tabWidth: options.tabWidth,
      keywordCase: options.keywordCase,
      linesBetweenQueries: 2
    })
    return { ok: true, output: output.trimEnd() }
  } catch (error) {
    const message =
      error instanceof Error ? error.message.split('\n')[0] : 'Unable to format this SQL.'
    return { ok: false, error: message }
  }
}
