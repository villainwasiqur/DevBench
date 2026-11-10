import { describe, expect, it } from 'vitest'
import {
  formatBytes,
  formatClaimTimestamp,
  formatLocal,
  formatNumber,
  formatRelativeTime,
  formatUtc
} from './format'

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })

describe('formatBytes', () => {
  it('renders byte values', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(1023)).toBe('1023 B')
  })

  it('renders kilobytes with one decimal below ten', () => {
    expect(formatBytes(1024)).toBe('1.0 KB')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(10 * 1024)).toBe('10 KB')
  })

  it('renders megabytes', () => {
    expect(formatBytes(1024 * 1024)).toBe('1.0 MB')
    expect(formatBytes(5.5 * 1024 * 1024)).toBe('5.5 MB')
  })
})

describe('formatRelativeTime', () => {
  const now = new Date('2024-05-01T12:00:00Z')

  it('treats very recent timestamps as "just now"', () => {
    expect(formatRelativeTime(now, now)).toBe('just now')
    expect(formatRelativeTime(new Date(now.getTime() + 4000), now)).toBe('just now')
  })

  it('uses seconds, minutes, hours, days, months, and years', () => {
    expect(formatRelativeTime(new Date(now.getTime() + 30_000), now)).toBe(
      relative.format(30, 'second')
    )
    expect(formatRelativeTime(new Date(now.getTime() - 5 * 60_000), now)).toBe(
      relative.format(-5, 'minute')
    )
    expect(formatRelativeTime(new Date(now.getTime() + 3 * 3_600_000), now)).toBe(
      relative.format(3, 'hour')
    )
    expect(formatRelativeTime(new Date(now.getTime() - 10 * 86_400_000), now)).toBe(
      relative.format(-10, 'day')
    )
    expect(formatRelativeTime(new Date(now.getTime() - 90 * 86_400_000), now)).toBe(
      relative.format(-3, 'month')
    )
    expect(formatRelativeTime(new Date(now.getTime() - 730 * 86_400_000), now)).toBe(
      relative.format(-2, 'year')
    )
  })
})

describe('date formatting', () => {
  const epoch = new Date(0)

  it('formats local dates without throwing', () => {
    expect(formatLocal(epoch)).toContain('1970')
  })

  it('labels UTC timestamps', () => {
    const utc = formatUtc(epoch)
    expect(utc).toContain('1970')
    expect(utc).toContain('UTC')
  })
})

describe('formatClaimTimestamp', () => {
  it('converts numeric claim seconds to a local date', () => {
    expect(formatClaimTimestamp(1700000000)).toBe(formatLocal(new Date(1700000000000)))
    expect(formatClaimTimestamp('1700000000')).toBe(formatLocal(new Date(1700000000000)))
  })

  it('passes through non-numeric values', () => {
    expect(formatClaimTimestamp('not-a-date')).toBe('not-a-date')
  })
})

describe('formatNumber', () => {
  it('matches the platform number format', () => {
    expect(formatNumber(0)).toBe('0')
    expect(formatNumber(1234)).toBe(new Intl.NumberFormat().format(1234))
  })
})
