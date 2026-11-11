import { describe, expect, it } from 'vitest'
import {
  durationBetween,
  formatCustom,
  isoWeek,
  offsetMinutes,
  parseDateInput,
  zonedParts
} from './time'

const instant = new Date('2026-11-11T09:05:07.123Z')

describe('parseDateInput', () => {
  it('reads seconds, milliseconds, and ISO strings', () => {
    expect(parseDateInput('1767225600')?.toISOString()).toBe('2026-01-01T00:00:00.000Z')
    expect(parseDateInput('1767225600123')?.toISOString()).toBe('2026-01-01T00:00:00.123Z')
    expect(parseDateInput('2026-11-11T09:05:07Z')?.toISOString()).toBe(
      '2026-11-11T09:05:07.000Z'
    )
    expect(parseDateInput('nope')).toBeNull()
    expect(parseDateInput('')).toBeNull()
  })
})

describe('zonedParts', () => {
  it('converts an instant into zone-local parts', () => {
    const parts = zonedParts(instant, 'Asia/Dhaka')
    expect(parts).toMatchObject({
      year: 2026,
      month: 11,
      day: 11,
      hour: 15,
      minute: 5,
      second: 7
    })
  })

  it('reports zone offsets', () => {
    expect(offsetMinutes(instant, 'UTC')).toBe(0)
    expect(offsetMinutes(instant, 'Asia/Dhaka')).toBe(360)
    expect(offsetMinutes(instant, 'America/New_York')).toBe(-300)
  })
})

describe('isoWeek', () => {
  it('handles week 53 and the first week of a year', () => {
    expect(isoWeek(new Date('2021-01-01T12:00:00Z'), 'UTC')).toEqual({ week: 53, year: 2020 })
    expect(isoWeek(new Date('2026-01-01T12:00:00Z'), 'UTC')).toEqual({ week: 1, year: 2026 })
    expect(isoWeek(instant, 'UTC')).toEqual({ week: 46, year: 2026 })
  })
})

describe('formatCustom', () => {
  it('replaces date tokens in a single pass', () => {
    expect(formatCustom(instant, 'UTC', 'YYYY-MM-DD HH:mm:ss.SSS')).toBe(
      '2026-11-11 09:05:07.123'
    )
    expect(formatCustom(instant, 'UTC', 'ddd, MMM D YYYY [at] h:mm A')).toBe(
      'Wed, Nov 11 2026 at 9:05 AM'
    )
  })

  it('uses the selected zone offset', () => {
    expect(formatCustom(instant, 'Asia/Dhaka', 'HH:mm Z')).toBe('15:05 +06:00')
    expect(formatCustom(instant, 'America/New_York', 'YYYY-MM-DD HH:mm ZZ')).toBe(
      '2026-11-11 04:05 -0500'
    )
  })

  it('returns an empty string for an empty pattern', () => {
    expect(formatCustom(instant, 'UTC', '')).toBe('')
  })
})

describe('durationBetween', () => {
  it('breaks a duration into units', () => {
    const result = durationBetween(new Date('2026-01-01T00:00:00Z'), new Date('2026-01-02T02:30:45Z'))
    expect(result).toMatchObject({
      negative: false,
      days: 1,
      hours: 2,
      minutes: 30,
      seconds: 45,
      totalHours: 26,
      totalWeeks: 0
    })
    expect(result.human).toBe('1 day 2 hours …')
  })

  it('marks reversed ranges', () => {
    const result = durationBetween(new Date('2026-01-02T00:00:00Z'), new Date('2026-01-01T00:00:00Z'))
    expect(result.negative).toBe(true)
    expect(result.days).toBe(1)
  })
})
