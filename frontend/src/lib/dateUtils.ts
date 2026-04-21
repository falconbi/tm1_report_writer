/**
 * Parse an ISO date string, treating naive strings (no timezone suffix) as UTC.
 * SQLite stores datetimes without timezone info — without this fix, JS would
 * interpret them as local time instead of UTC, causing a 12-hour offset in NZ.
 */
export function parseDate(s?: string | null): Date | null {
  if (!s) return null
  const str = s.endsWith('Z') || s.includes('+') ? s : s + 'Z'
  return new Date(str)
}

export function fmtDateTime(s?: string | null): string {
  const d = parseDate(s)
  if (!d) return '—'
  return d.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function fmtDate(s?: string | null): string {
  const d = parseDate(s)
  if (!d) return '—'
  return d.toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}
