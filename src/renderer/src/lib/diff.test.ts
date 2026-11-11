import { describe, expect, it } from 'vitest'
import { diffLines, summarizeDiff } from './diff'

describe('diffLines', () => {
  it('marks identical text as unchanged', () => {
    const rows = diffLines('alpha\nbeta', 'alpha\nbeta')
    expect(rows).toEqual([
      { type: 'equal', left: 'alpha', right: 'alpha', leftNumber: 1, rightNumber: 1 },
      { type: 'equal', left: 'beta', right: 'beta', leftNumber: 2, rightNumber: 2 }
    ])
  })

  it('detects inserted lines', () => {
    const rows = diffLines('alpha\nbeta', 'alpha\ngamma\nbeta')
    expect(rows.map((row) => row.type)).toEqual(['equal', 'add', 'equal'])
    expect(rows[1]).toEqual({ type: 'add', right: 'gamma', rightNumber: 2 })
    expect(rows[2].leftNumber).toBe(2)
    expect(rows[2].rightNumber).toBe(3)
  })

  it('detects removed lines', () => {
    const rows = diffLines('alpha\ngamma\nbeta', 'alpha\nbeta')
    expect(rows.map((row) => row.type)).toEqual(['equal', 'remove', 'equal'])
    expect(rows[1]).toEqual({ type: 'remove', left: 'gamma', leftNumber: 2 })
    expect(rows[2].leftNumber).toBe(3)
    expect(rows[2].rightNumber).toBe(2)
  })

  it('reports a replacement as a removal followed by an addition', () => {
    const rows = diffLines('old', 'new')
    expect(rows).toEqual([
      { type: 'remove', left: 'old', leftNumber: 1 },
      { type: 'add', right: 'new', rightNumber: 1 }
    ])
  })

  it('ignores trailing newline differences', () => {
    expect(diffLines('alpha\n', 'alpha')).toHaveLength(1)
  })

  it('can ignore whitespace changes', () => {
    const rows = diffLines('const   value = 1;', 'const value = 1;', {
      ignoreWhitespace: true
    })
    expect(rows).toHaveLength(1)
    expect(rows[0].type).toBe('equal')
  })

  it('can ignore case changes', () => {
    const rows = diffLines('Hello', 'hello', { ignoreCase: true })
    expect(rows).toHaveLength(1)
    expect(rows[0].type).toBe('equal')
  })

  it('handles an empty left side', () => {
    const rows = diffLines('', 'one\ntwo')
    expect(rows.map((row) => row.type)).toEqual(['add', 'add'])
    expect(rows.map((row) => row.rightNumber)).toEqual([1, 2])
  })

  it('handles an empty right side', () => {
    const rows = diffLines('one\ntwo', '')
    expect(rows.map((row) => row.type)).toEqual(['remove', 'remove'])
  })

  it('returns no rows for two empty inputs', () => {
    expect(diffLines('', '')).toEqual([])
  })
})

describe('summarizeDiff', () => {
  it('counts additions, removals, and unchanged lines', () => {
    const summary = summarizeDiff(diffLines('keep\nold', 'keep\nnew\nextra'))
    expect(summary).toEqual({ added: 2, removed: 1, unchanged: 1, changed: true })
  })

  it('reports no change for identical input', () => {
    const summary = summarizeDiff(diffLines('same', 'same'))
    expect(summary).toEqual({ added: 0, removed: 0, unchanged: 1, changed: false })
  })
})
