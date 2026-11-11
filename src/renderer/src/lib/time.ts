export interface ZonedParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
  weekday: number
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

const MONTHS = [
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
] as const

const DAY_FORMAT = ['dddd', 'ddd', 'MMMM', 'MMM', 'YYYY', 'YY', 'MM', 'DD', 'HH', 'hh', 'mm', 'ss', 'SSS', 'ZZ', 'Z', 'A', 'a', 'X', 'x', 'M', 'D', 'H', 'h', 'm', 's']

const FORMATTERS = new Map<string, Intl.DateTimeFormat>()

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  const cached = FORMATTERS.get(timeZone)
  if (cached) return cached

  let formatter: Intl.DateTimeFormat
  try {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      weekday: 'short',
      hourCycle: 'h23'
    })
  } catch {
    throw new Error(`Unknown time zone: ${timeZone}`)
  }

  FORMATTERS.set(timeZone, formatter)
  return formatter
}

export function parseDateInput(raw: string): Date | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    const numeric = Number(trimmed)
    if (!Number.isFinite(numeric)) return null
    const milliseconds = Math.abs(numeric) >= 1e11 ? numeric : numeric * 1000
    const date = new Date(milliseconds)
    return Number.isNaN(date.getTime()) ? null : date
  }

  const date = new Date(trimmed)
  return Number.isNaN(date.getTime()) ? null : date
}

export function zonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = formatterFor(timeZone).formatToParts(date)
  const lookup: Record<string, string> = {}
  for (const part of parts) {
    if (part.type !== 'literal') lookup[part.type] = part.value
  }

  const weekdayIndex = WEEKDAYS.findIndex((label) => label === lookup.weekday)

  return {
    year: Number(lookup.year),
    month: Number(lookup.month),
    day: Number(lookup.day),
    hour: Number(lookup.hour) % 24,
    minute: Number(lookup.minute),
    second: Number(lookup.second),
    weekday: weekdayIndex >= 0 ? weekdayIndex : 0
  }
}

export function offsetMinutes(date: Date, timeZone: string): number {
  const parts = zonedParts(date, timeZone)
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
  const wholeSeconds = Math.floor(date.getTime() / 1000) * 1000
  return Math.round((asUtc - wholeSeconds) / 60000)
}

function pad(value: number, length = 2): string {
  return String(value).padStart(length, '0')
}

export function isoWeek(date: Date, timeZone: string): { week: number; year: number } {
  const parts = zonedParts(date, timeZone)
  const target = new Date(Date.UTC(parts.year, parts.month - 1, parts.day))
  const weekday = (target.getUTCDay() + 6) % 7
  target.setUTCDate(target.getUTCDate() - weekday + 3)
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4))
  const week =
    1 +
    Math.round(
      ((target.getTime() - firstThursday.getTime()) / 86400000 -
        3 +
        ((firstThursday.getUTCDay() + 6) % 7)) /
        7
    )
  return { week, year: target.getUTCFullYear() }
}

export function formatInZone(
  date: Date,
  timeZone: string,
  options: Intl.DateTimeFormatOptions
): string {
  try {
    return new Intl.DateTimeFormat(undefined, { ...options, timeZone }).format(date)
  } catch {
    throw new Error(`Unknown time zone: ${timeZone}`)
  }
}

export function formatCustom(date: Date, timeZone: string, pattern: string): string {
  if (!pattern.trim()) return ''
  const parts = zonedParts(date, timeZone)
  const offset = offsetMinutes(date, timeZone)
  const sign = offset >= 0 ? '+' : '-'
  const absolute = Math.abs(offset)
  const hour12 = parts.hour % 12 === 0 ? 12 : parts.hour % 12
  const weekdayLong = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone }).format(date)
  const monthLong = new Intl.DateTimeFormat('en-US', { month: 'long', timeZone }).format(date)

  const tokens: Record<string, string> = {
    dddd: weekdayLong,
    ddd: WEEKDAYS[parts.weekday],
    MMMM: monthLong,
    MMM: MONTHS[parts.month - 1].slice(0, 3),
    YYYY: String(parts.year),
    YY: pad(parts.year % 100),
    MM: pad(parts.month),
    DD: pad(parts.day),
    HH: pad(parts.hour),
    hh: pad(hour12),
    mm: pad(parts.minute),
    ss: pad(parts.second),
    SSS: pad(date.getMilliseconds(), 3),
    ZZ: `${sign}${pad(Math.floor(absolute / 60))}${pad(absolute % 60)}`,
    Z: `${sign}${pad(Math.floor(absolute / 60))}:${pad(absolute % 60)}`,
    A: parts.hour < 12 ? 'AM' : 'PM',
    a: parts.hour < 12 ? 'am' : 'pm',
    X: String(Math.floor(date.getTime() / 1000)),
    x: String(date.getTime()),
    M: String(parts.month),
    D: String(parts.day),
    H: String(parts.hour),
    h: String(hour12),
    m: String(parts.minute),
    s: String(parts.second)
  }

  const names = DAY_FORMAT.join('|')
  return pattern.replace(
    new RegExp(`\\[([^\\]]*)\\]|${names}`, 'g'),
    (match, literal: string | undefined) => {
      if (literal !== undefined) return literal
      return tokens[match] ?? match
    }
  )
}

export function timeZoneOptions(): string[] {
  try {
    const zones = Intl.supportedValuesOf('timeZone')
    if (zones.length > 0) return zones
  } catch {
    // Older runtimes may not expose supportedValuesOf.
  }
  return [
    'UTC',
    'Asia/Dhaka',
    'Asia/Kolkata',
    'Asia/Tokyo',
    'Europe/London',
    'Europe/Berlin',
    'America/New_York',
    'America/Chicago',
    'America/Los_Angeles',
    'Australia/Sydney'
  ]
}

export interface DurationBreakdown {
  negative: boolean
  days: number
  hours: number
  minutes: number
  seconds: number
  totalSeconds: number
  totalMinutes: number
  totalHours: number
  totalDays: number
  totalWeeks: number
  human: string
}

export function durationBetween(from: Date, to: Date): DurationBreakdown {
  const milliseconds = Math.abs(to.getTime() - from.getTime())
  const totalSeconds = Math.floor(milliseconds / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  const pieces: string[] = []
  if (days) pieces.push(`${days} day${days === 1 ? '' : 's'}`)
  if (hours) pieces.push(`${hours} hour${hours === 1 ? '' : 's'}`)
  if (minutes) pieces.push(`${minutes} minute${minutes === 1 ? '' : 's'}`)
  if (seconds || pieces.length === 0) pieces.push(`${seconds} second${seconds === 1 ? '' : 's'}`)

  return {
    negative: to.getTime() < from.getTime(),
    days,
    hours,
    minutes,
    seconds,
    totalSeconds,
    totalMinutes: Math.floor(totalSeconds / 60),
    totalHours: Math.floor(totalSeconds / 3600),
    totalDays: Math.floor(totalSeconds / 86400),
    totalWeeks: Math.floor(totalSeconds / 604800),
    human: `${pieces.slice(0, 2).join(' ')}${pieces.length > 2 ? ' …' : ''}`
  }
}
