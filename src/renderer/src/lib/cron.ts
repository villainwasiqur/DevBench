export interface CronFields {
  minute: number[]
  hour: number[]
  dayOfMonth: number[]
  month: number[]
  dayOfWeek: number[]
}

export interface CronDetail {
  label: string
  text: string
}

export type CronParseResult =
  | { ok: true; fields: CronFields; normalized: string }
  | { ok: false; error: string }

export type CronAnalysis =
  | {
      ok: true
      fields: CronFields
      normalized: string
      summary: string
      details: CronDetail[]
      notes: string[]
      nextRuns: Date[]
    }
  | { ok: false; error: string }

const MONTH_NAMES = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
const WEEKDAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const MONTH_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
]
const WEEKDAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const ALIASES: Record<string, string> = {
  '@yearly': '0 0 1 1 *',
  '@annually': '0 0 1 1 *',
  '@monthly': '0 0 1 * *',
  '@weekly': '0 0 * * 0',
  '@daily': '0 0 * * *',
  '@midnight': '0 0 * * *',
  '@hourly': '0 * * * *'
}

interface FieldSpec {
  key: keyof CronFields
  label: string
  min: number
  max: number
  names?: readonly string[]
  nameOffset: number
  allowQuestion?: boolean
}

const FIELD_SPECS: readonly FieldSpec[] = [
  { key: 'minute', label: 'Minute', min: 0, max: 59, nameOffset: 0 },
  { key: 'hour', label: 'Hour', min: 0, max: 23, nameOffset: 0 },
  { key: 'dayOfMonth', label: 'Day of month', min: 1, max: 31, nameOffset: 0, allowQuestion: true },
  {
    key: 'month',
    label: 'Month',
    min: 1,
    max: 12,
    names: MONTH_NAMES,
    nameOffset: 1
  },
  {
    key: 'dayOfWeek',
    label: 'Day of week',
    min: 0,
    max: 7,
    names: WEEKDAY_NAMES,
    nameOffset: 0,
    allowQuestion: true
  }
]

function fieldValue(token: string, spec: FieldSpec): number | null {
  if (/^\d+$/.test(token)) {
    const numeric = Number(token)
    return numeric >= spec.min && numeric <= spec.max ? numeric : null
  }
  if (spec.names) {
    const upper = token.toUpperCase()
    if (upper.length < 3) return null
    const index = spec.names.indexOf(upper.slice(0, 3))
    if (index === -1) return null
    return index + spec.nameOffset
  }
  return null
}

function parseField(raw: string, spec: FieldSpec): { ok: true; values: number[] } | { ok: false; error: string } {
  const values = new Set<number>()
  const items = raw.split(',')
  if (items.some((item) => item === '')) {
    return { ok: false, error: `${spec.label}: lists cannot contain empty entries.` }
  }

  for (const item of items) {
    const parts = item.split('/')
    if (parts.length > 2) {
      return { ok: false, error: `${spec.label}: “${item}” has more than one step.` }
    }

    let step = 1
    if (parts.length === 2) {
      if (!/^\d+$/.test(parts[1]) || Number(parts[1]) < 1) {
        return { ok: false, error: `${spec.label}: the step must be a whole number above zero.` }
      }
      step = Number(parts[1])
    }

    const base = parts[0]
    let start: number
    let end: number

    if (base === '*' || (base === '?' && spec.allowQuestion)) {
      start = spec.min
      end = spec.max
    } else if (base.includes('-')) {
      const bounds = base.split('-')
      if (bounds.length !== 2) {
        return { ok: false, error: `${spec.label}: “${item}” is not a valid range.` }
      }
      const left = fieldValue(bounds[0], spec)
      const right = fieldValue(bounds[1], spec)
      if (left === null || right === null) {
        return {
          ok: false,
          error: `${spec.label}: “${base}” is not a valid range (${spec.min}-${spec.max}).`
        }
      }
      if (left > right) {
        return { ok: false, error: `${spec.label}: ranges must go from low to high, not “${base}”.` }
      }
      start = left
      end = right
    } else {
      const single = fieldValue(base, spec)
      if (single === null) {
        return {
          ok: false,
          error: `${spec.label}: “${base}” is not a valid value (${spec.min}-${spec.max}).`
        }
      }
      start = single
      end = parts.length === 2 ? spec.max : single
    }

    for (let value = start; value <= end; value += step) {
      values.add(spec.key === 'dayOfWeek' && value === 7 ? 0 : value)
    }
  }

  return { ok: true, values: [...values].sort((a, b) => a - b) }
}

export function parseCron(expression: string): CronParseResult {
  const trimmed = expression.trim()
  if (!trimmed) return { ok: false, error: 'Enter a cron expression.' }

  const lowered = trimmed.toLowerCase()
  if (lowered === '@reboot') {
    return {
      ok: false,
      error: '@reboot runs at startup, so it has no schedule or next run times.'
    }
  }

  const expanded = ALIASES[lowered] ?? trimmed
  const tokens = expanded.split(/\s+/)
  if (tokens.length === 6) {
    return {
      ok: false,
      error: 'Six-field expressions with seconds are not supported. Use minute hour day month weekday.'
    }
  }
  if (tokens.length !== 5) {
    return {
      ok: false,
      error: 'A cron expression needs five fields: minute hour day month weekday.'
    }
  }

  const fields = {} as CronFields
  for (let index = 0; index < FIELD_SPECS.length; index += 1) {
    const parsed = parseField(tokens[index], FIELD_SPECS[index])
    if (!parsed.ok) return parsed
    fields[FIELD_SPECS[index].key] = parsed.values
  }

  return {
    ok: true,
    fields,
    normalized: [
      fields.minute.join(','),
      fields.hour.join(','),
      fields.dayOfMonth.join(','),
      fields.month.join(','),
      fields.dayOfWeek.join(',')
    ].join(' ')
  }
}

function joinList(items: string[]): string {
  if (items.length === 0) return ''
  if (items.length === 1) return items[0]
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function stepOf(values: number[]): number | null {
  if (values.length < 2) return null
  const step = values[1] - values[0]
  if (step < 1) return null
  return values.every((value, index) => index === 0 || value - values[index - 1] === step)
    ? step
    : null
}

function weekdayText(values: number[]): string {
  const key = values.join(',')
  if (key === '1,2,3,4,5') return 'Monday through Friday'
  if (key === '0,6') return 'Saturday and Sunday'
  return joinList(values.map((value) => WEEKDAY_LABELS[value]))
}

function minuteDetail(values: number[]): string {
  if (values.length === 60) return 'Every minute'
  if (values.length === 1) return `At minute ${values[0]}`
  const step = stepOf(values)
  if (step === 1) return `Every minute from ${values[0]} through ${values[values.length - 1]}`
  if (step) return `Every ${step} minutes`
  return `At minutes ${joinList(values.map(String))}`
}

function minutePhrase(values: number[]): string {
  if (values.length === 1) return `at minute ${values[0]}`
  const step = stepOf(values)
  if (step === 1) return `every minute from ${values[0]} through ${values[values.length - 1]}`
  if (step) return `every ${step} minutes`
  return `at minutes ${joinList(values.map(String))}`
}

function hoursPhrase(values: number[]): string {
  const step = stepOf(values)
  if (step === 1) return `every hour from ${pad(values[0])} through ${pad(values[values.length - 1])}`
  if (step) return `every ${step} hours`
  if (values.length === 1) return `hour ${pad(values[0])}`
  return `hours ${joinList(values.map(pad))}`
}

export function describeCron(fields: CronFields): { summary: string; details: CronDetail[]; notes: string[] } {
  const minuteAll = fields.minute.length === 60
  const hourAll = fields.hour.length === 24
  const domAll = fields.dayOfMonth.length === 31
  const dowAll = fields.dayOfWeek.length === 7
  const monthAll = fields.month.length === 12
  const minuteStep = stepOf(fields.minute)
  const hourStep = stepOf(fields.hour)

  let base: string
  if (minuteAll && hourAll) {
    base = 'Runs every minute'
  } else if (minuteAll) {
    base = hourStep
      ? `Runs every minute during every ${hourStep}-hour interval`
      : `Runs every minute during ${hoursPhrase(fields.hour)}`
  } else if (hourAll) {
    if (fields.minute.length === 1) base = `Runs every hour at minute ${fields.minute[0]}`
    else if (minuteStep && fields.minute[0] === 0) base = `Runs every ${minuteStep} minutes`
    else base = `Runs ${minutePhrase(fields.minute)} during every hour`
  } else if (fields.minute.length === 1 && fields.hour.length === 1) {
    base = `Runs at ${pad(fields.hour[0])}:${pad(fields.minute[0])}`
  } else if (fields.minute.length === 1) {
    const minute = fields.minute[0]
    if (hourStep && fields.hour[0] === 0) {
      base = `Runs every ${hourStep} hours at minute ${minute}`
    } else {
      base = `Runs at ${joinList(fields.hour.map((hour) => `${pad(hour)}:${pad(minute)}`))}`
    }
  } else {
    base = `Runs ${minutePhrase(fields.minute)} during ${hoursPhrase(fields.hour)}`
  }

  let dayClause = ''
  if (domAll && dowAll) {
    dayClause = ' every day'
  } else if (!domAll && !dowAll) {
    const dom =
      fields.dayOfMonth.length === 1
        ? `day ${fields.dayOfMonth[0]}`
        : `days ${joinList(fields.dayOfMonth.map(String))}`
    dayClause = ` on ${dom} or ${weekdayText(fields.dayOfWeek)}`
  } else if (!domAll) {
    const dom =
      fields.dayOfMonth.length === 1
        ? `day ${fields.dayOfMonth[0]}`
        : `days ${joinList(fields.dayOfMonth.map(String))}`
    dayClause = ` on ${dom}`
  } else {
    dayClause = ` on ${weekdayText(fields.dayOfWeek)}`
  }

  const monthClause = monthAll
    ? ''
    : ` in ${joinList(fields.month.map((value) => MONTH_LABELS[value - 1]))}`

  const summary = `${base}${dayClause}${monthClause}.`

  const hoursDetail =
    fields.hour.length === 24
      ? 'Every hour'
      : fields.hour.length === 1
        ? `At hour ${pad(fields.hour[0])}`
        : hourStep === 1
          ? `Every hour from ${pad(fields.hour[0])} through ${pad(fields.hour[fields.hour.length - 1])}`
          : hourStep
            ? `Every ${hourStep} hours`
            : `At hours ${joinList(fields.hour.map(pad))}`

  const domDetail =
    domAll
      ? 'Every day of the month'
      : fields.dayOfMonth.length === 1
        ? `On day ${fields.dayOfMonth[0]}`
        : `On days ${joinList(fields.dayOfMonth.map(String))}`

  const dowDetail = dowAll ? 'Every day of the week' : `On ${weekdayText(fields.dayOfWeek)}`

  const details: CronDetail[] = [
    { label: 'Minute', text: minuteDetail(fields.minute) },
    { label: 'Hour', text: hoursDetail },
    { label: 'Day of month', text: domDetail },
    { label: 'Month', text: monthAll ? 'Every month' : `In ${joinList(fields.month.map((value) => MONTH_LABELS[value - 1]))}` },
    { label: 'Day of week', text: dowDetail }
  ]

  const notes: string[] = []
  if (!domAll && !dowAll) {
    notes.push(
      'Both day fields are restricted, so cron runs on days matching either the day of the month or the weekday.'
    )
  }

  return { summary, details, notes }
}

export function nextRunTimes(fields: CronFields, count = 5, from = new Date()): Date[] {
  const runs: Date[] = []
  if (count < 1) return runs

  const cursor = new Date(from.getTime())
  cursor.setSeconds(0, 0)
  cursor.setMinutes(cursor.getMinutes() + 1)

  const domAll = fields.dayOfMonth.length === 31
  const dowAll = fields.dayOfWeek.length === 7
  const limit = 366 * 24 * 60

  for (let offset = 0; offset < limit && runs.length < count; offset += 1) {
    const month = cursor.getMonth() + 1
    const dayOfMonth = cursor.getDate()
    const dayOfWeek = cursor.getDay()

    let dayMatches: boolean
    if (domAll && dowAll) dayMatches = true
    else if (domAll) dayMatches = fields.dayOfWeek.includes(dayOfWeek)
    else if (dowAll) dayMatches = fields.dayOfMonth.includes(dayOfMonth)
    else dayMatches = fields.dayOfMonth.includes(dayOfMonth) || fields.dayOfWeek.includes(dayOfWeek)

    if (
      dayMatches &&
      fields.month.includes(month) &&
      fields.hour.includes(cursor.getHours()) &&
      fields.minute.includes(cursor.getMinutes())
    ) {
      runs.push(new Date(cursor))
    }

    cursor.setMinutes(cursor.getMinutes() + 1)
  }

  return runs
}

export function analyzeCron(
  expression: string,
  options: { from?: Date; count?: number } = {}
): CronAnalysis {
  const parsed = parseCron(expression)
  if (!parsed.ok) return parsed

  const { summary, details, notes } = describeCron(parsed.fields)
  const nextRuns = nextRunTimes(parsed.fields, options.count ?? 5, options.from ?? new Date())
  if (nextRuns.length === 0) {
    notes.push('No scheduled run occurs within the next 366 days.')
  }

  return {
    ok: true,
    fields: parsed.fields,
    normalized: parsed.normalized,
    summary,
    details,
    notes,
    nextRuns
  }
}
