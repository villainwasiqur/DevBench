import { describe, expect, it } from 'vitest'
import { bestFuzzyScore, fuzzyScore } from './fuzzy'

describe('fuzzyScore', () => {
  it('returns zero for an empty query', () => {
    expect(fuzzyScore('JSON Formatter', '   ')).toBe(0)
  })

  it('scores direct substrings above scattered matches', () => {
    const direct = fuzzyScore('JSON Formatter', 'format')
    const scattered = fuzzyScore('JSON Formatter', 'jfmt')
    expect(direct).not.toBeNull()
    expect(scattered).not.toBeNull()
    expect(direct!).toBeGreaterThan(scattered!)
  })

  it('prefers matches at word boundaries', () => {
    const boundary = fuzzyScore('Base64 Encoder', 'enc')
    const mid = fuzzyScore('Base64 Encoder', 'cod')
    expect(boundary!).toBeGreaterThan(mid!)
  })

  it('matches subsequences across words', () => {
    expect(fuzzyScore('Timestamp Converter', 'tsconv')).not.toBeNull()
  })

  it('rejects characters that do not appear in order', () => {
    expect(fuzzyScore('Cron Parser', 'xyz')).toBeNull()
    expect(fuzzyScore('Cron Parser', 'nosrc')).toBeNull()
  })
})

describe('bestFuzzyScore', () => {
  it('returns the highest score across fields', () => {
    const score = bestFuzzyScore(['UUID Generator', 'uuid guid random identifier v4'], 'guid')
    expect(score).not.toBeNull()
    expect(score!).toBeGreaterThan(0)
  })

  it('returns null when nothing matches', () => {
    expect(bestFuzzyScore(['Hash Generator', 'sha digest'], 'qr')).toBeNull()
  })
})
