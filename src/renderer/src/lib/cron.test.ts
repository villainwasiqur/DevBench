import { describe, expect, it } from 'vitest'
import { analyzeCron, describeCron, nextRunTimes, parseCron, type CronFields } from './cron'

function fieldsOf(expression: string): CronFields {
  const parsed = parseCron(expression)
  if (!parsed.ok) throw new Error(parsed.error)
  return parsed.fields
}

const START = new Date(2026, 0, 1, 0, 0, 0)

describe('parseCron', () => {
  it('expands wildcards and steps', () => {
    const fields = fieldsOf('*/15 * * * *')
    expect(fields.minute).toEqual([0, 15, 30, 45])
    expect(fields.hour).toHaveLength(24)
    expect(fields.dayOfMonth).toHaveLength(31)
    expect(fields.month).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
    expect(fields.dayOfWeek).toEqual([0, 1, 2, 3, 4, 5, 6])
  })

  it('parses ranges and lists', () => {
    const fields = fieldsOf('0 9,17 * * 1-5')
    expect(fields.minute).toEqual([0])
    expect(fields.hour).toEqual([9, 17])
    expect(fields.dayOfWeek).toEqual([1, 2, 3, 4, 5])
  })

  it('accepts month and weekday names', () => {
    const fields = fieldsOf('0 9 * JAN-MAR MON-FRI')
    expect(fields.month).toEqual([1, 2, 3])
    expect(fields.dayOfWeek).toEqual([1, 2, 3, 4, 5])
  })

  it('normalizes Sunday as both 0 and 7', () => {
    expect(fieldsOf('0 0 * * 7').dayOfWeek).toEqual([0])
    expect(fieldsOf('0 0 * * SUN').dayOfWeek).toEqual([0])
  })

  it('supports a starting step without a range', () => {
    expect(fieldsOf('5/15 * * * *').minute).toEqual([5, 20, 35, 50])
  })

  it('accepts question marks on day fields', () => {
    expect(fieldsOf('0 0 ? * MON').dayOfMonth).toHaveLength(31)
    expect(fieldsOf('0 0 15 * ?').dayOfWeek).toEqual([0, 1, 2, 3, 4, 5, 6])
  })

  it('expands aliases', () => {
    expect(fieldsOf('@weekly').dayOfWeek).toEqual([0])
    expect(fieldsOf('@yearly').month).toEqual([1])
    expect(fieldsOf('@hourly').minute).toEqual([0])
  })

  it('reports invalid expressions', () => {
    expect(parseCron('')).toEqual({ ok: false, error: 'Enter a cron expression.' })
    expect(parseCron('0 0 * *')).toMatchObject({ ok: false, error: expect.stringContaining('five fields') })
    expect(parseCron('0 0 * * * *')).toMatchObject({
      ok: false,
      error: expect.stringContaining('Six-field')
    })
    expect(parseCron('61 * * * *')).toMatchObject({ ok: false, error: expect.stringContaining('Minute') })
    expect(parseCron('*/0 * * * *')).toMatchObject({ ok: false, error: expect.stringContaining('step') })
    expect(parseCron('10-5 * * * *')).toMatchObject({
      ok: false,
      error: expect.stringContaining('low to high')
    })
    expect(parseCron('0 0 * FOO *')).toMatchObject({ ok: false, error: expect.stringContaining('Month') })
    expect(parseCron('? * * * *')).toMatchObject({ ok: false, error: expect.stringContaining('Minute') })
    expect(parseCron('0 0 1 * 8')).toMatchObject({ ok: false, error: expect.stringContaining('Day of week') })
    expect(parseCron('@reboot')).toMatchObject({ ok: false, error: expect.stringContaining('@reboot') })
  })
})

describe('describeCron', () => {
  it('explains a step schedule', () => {
    const analysis = analyzeCron('*/15 * * * *', { from: START })
    expect(analysis.ok).toBe(true)
    if (!analysis.ok) return
    expect(analysis.summary).toBe('Runs every 15 minutes every day.')
    expect(analysis.details[0]).toEqual({ label: 'Minute', text: 'Every 15 minutes' })
  })

  it('phrases consecutive hour ranges without a step', () => {
    const analysis = analyzeCron('*/15 9-17 * * 1-5', { from: START })
    expect(analysis.ok).toBe(true)
    if (!analysis.ok) return
    expect(analysis.summary).toBe(
      'Runs every 15 minutes during every hour from 09 through 17 on Monday through Friday.'
    )
    expect(analysis.details[1]).toEqual({ label: 'Hour', text: 'Every hour from 09 through 17' })
    expect(analysis.summary).not.toContain('every 1 hours')
  })

  it('explains weekday schedules', () => {
    const analysis = analyzeCron('0 9 * * 1-5', { from: START })
    expect(analysis.ok).toBe(true)
    if (!analysis.ok) return
    expect(analysis.summary).toBe('Runs at 09:00 on Monday through Friday.')
    expect(analysis.details[4].text).toBe('On Monday through Friday')
  })

  it('explains monthly and yearly schedules', () => {
    const monthly = analyzeCron('0 0 1 * *', { from: START })
    expect(monthly.ok && monthly.summary).toBe('Runs at 00:00 on day 1.')
    const yearly = analyzeCron('0 0 1 1 *', { from: START })
    expect(yearly.ok && yearly.summary).toBe('Runs at 00:00 on day 1 in January.')
  })

  it('lists multiple run times', () => {
    const analysis = analyzeCron('0 9,17 * * *', { from: START })
    expect(analysis.ok && analysis.summary).toBe('Runs at 09:00 and 17:00 every day.')
  })

  it('notes the day-of-month or weekday rule', () => {
    const analysis = analyzeCron('0 0 13 * 5', { from: START })
    expect(analysis.ok).toBe(true)
    if (!analysis.ok) return
    expect(analysis.summary).toBe('Runs at 00:00 on day 13 or Friday.')
    expect(analysis.notes[0]).toContain('either the day of the month or the weekday')
  })

  it('describes weekday presets', () => {
    const fields = fieldsOf('0 0 * * 0,6')
    expect(describeCron(fields).details[4].text).toBe('On Saturday and Sunday')
  })
})

describe('nextRunTimes', () => {
  it('finds the next quarter-hour runs', () => {
    const runs = nextRunTimes(fieldsOf('*/15 * * * *'), 2, START)
    expect(runs.map((date) => date.getHours())).toEqual([0, 0])
    expect(runs.map((date) => date.getMinutes())).toEqual([15, 30])
  })

  it('finds the next Monday morning', () => {
    const [run] = nextRunTimes(fieldsOf('0 9 * * 1'), 1, START)
    expect(run.getFullYear()).toBe(2026)
    expect(run.getMonth()).toBe(0)
    expect(run.getDate()).toBe(5)
    expect(run.getDay()).toBe(1)
    expect(run.getHours()).toBe(9)
    expect(run.getMinutes()).toBe(0)
  })

  it('matches either day field when both are restricted', () => {
    const runs = nextRunTimes(fieldsOf('0 0 13 * 5'), 3, START)
    expect(runs.map((date) => date.getDate())).toEqual([2, 9, 13])
  })

  it('returns no runs for an impossible date', () => {
    const analysis = analyzeCron('0 0 31 2 *', { from: START })
    expect(analysis.ok).toBe(true)
    if (!analysis.ok) return
    expect(analysis.nextRuns).toEqual([])
    expect(analysis.notes).toContain('No scheduled run occurs within the next 366 days.')
  })

  it('honors aliases', () => {
    const [run] = nextRunTimes(fieldsOf('@hourly'), 1, START)
    expect(run.getHours()).toBe(1)
    expect(run.getMinutes()).toBe(0)
  })
})
