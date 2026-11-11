import { describe, expect, it } from 'vitest'
import { formatSql, MAX_SQL_LENGTH, type SqlFormatOptions } from './sql'

const BASE: SqlFormatOptions = { dialect: 'standard', keywordCase: 'upper', tabWidth: 2 }

function outputOf(input: string, overrides: Partial<SqlFormatOptions> = {}): string {
  const result = formatSql(input, { ...BASE, ...overrides })
  if (!result.ok) throw new Error(result.error)
  return result.output
}

describe('formatSql', () => {
  it('formats a query with uppercase keywords', () => {
    const output = outputOf('select id, name from users where active = 1 order by name')
    expect(output).toBe(
      ['SELECT', '  id,', '  name', 'FROM', '  users', 'WHERE', '  active = 1', 'ORDER BY', '  name'].join(
        '\n'
      )
    )
  })

  it('keeps keywords lowercase when requested', () => {
    const output = outputOf('SELECT id FROM users', { keywordCase: 'lower' })
    expect(output).toBe('select\n  id\nfrom\n  users')
  })

  it('preserves original keyword case', () => {
    expect(outputOf('SeLeCt id FROM users', { keywordCase: 'preserve' })).toContain('SeLeCt')
  })

  it('honors the tab width', () => {
    expect(outputOf('select id from users', { tabWidth: 4 })).toContain('\n    id')
  })

  it('formats MySQL identifiers', () => {
    const output = outputOf('select `id` from `users`', { dialect: 'mysql' })
    expect(output).toContain('`id`')
    expect(output).toContain('`users`')
  })

  it('formats PostgreSQL casts', () => {
    const output = outputOf("select now()::timestamptz from users", { dialect: 'postgresql' })
    expect(output).toContain('::')
    expect(output.toUpperCase()).toContain('SELECT')
  })

  it('returns an empty output for blank input', () => {
    expect(formatSql('', BASE)).toEqual({ ok: true, output: '' })
    expect(formatSql('   \n  ', BASE)).toEqual({ ok: true, output: '' })
  })

  it('rejects oversized queries', () => {
    const result = formatSql('select 1'.padEnd(MAX_SQL_LENGTH + 1, ' '), BASE)
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining('under') })
  })

  it('reports syntax the formatter cannot handle', () => {
    const result = formatSql('SELECT ( FROM t', BASE)
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining('Parse error') })
  })
})
