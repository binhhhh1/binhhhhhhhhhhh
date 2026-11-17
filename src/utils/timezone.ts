export const VN_TIMEZONE = 'Asia/Ho_Chi_Minh';

/**
 * Returns YYYY-MM-DD in Asia/Ho_Chi_Minh for a given Date.
 */
export function getVNDateKey(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: VN_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((p) => p.type === 'year')?.value ?? '2026';
  const month = parts.find((p) => p.type === 'month')?.value ?? '01';
  const day = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${year}-${month}-${day}`;
}

/**
 * Returns HH:mm in Asia/Ho_Chi_Minh for a given Date.
 */
export function getVNTimeStr(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: VN_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const hour = parts.find((p) => p.type === 'hour')?.value ?? '00';
  const minute = parts.find((p) => p.type === 'minute')?.value ?? '00';
  return `${hour === '24' ? '00' : hour}:${minute}`;
}

/**
 * Returns HH:mm:ss and formatted Vietnamese date in Asia/Ho_Chi_Minh.
 */
export function getVNClockDisplay(date: Date = new Date()): {
  time: string;
  dateLabel: string;
  weekday: string;
} {
  const time = new Intl.DateTimeFormat('vi-VN', {
    timeZone: VN_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);

  const dateLabel = new Intl.DateTimeFormat('vi-VN', {
    timeZone: VN_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);

  const weekday = new Intl.DateTimeFormat('vi-VN', {
    timeZone: VN_TIMEZONE,
    weekday: 'long',
  }).format(date);

  return { time, dateLabel, weekday };
}

export function timeToMinutes(hhmm: string): number {
  const match = /^(\d{2}):(\d{2})$/.exec(hhmm.trim());
  if (!match) return 0;
  const h = Number(match[1]);
  const m = Number(match[2]);
  return Math.max(0, Math.min(24 * 60, h * 60 + m));
}

export function minutesToTime(totalMin: number): string {
  const clamped = Math.max(0, Math.min(24 * 60, Math.round(totalMin)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function addDaysToDateKey(dateKey: string, deltaDays: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const utc = Date.UTC(y, m - 1, d + deltaDays, 12, 0, 0);
  return getVNDateKey(new Date(utc));
}

export function getWeekdayIndexMonFirst(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const jsDay = dt.getUTCDay(); // 0=Sun..6=Sat
  return jsDay === 0 ? 6 : jsDay - 1; // 0=Mon..6=Sun
}

export function getWeekDateKeys(anchorDateKey: string): string[] {
  const offset = getWeekdayIndexMonFirst(anchorDateKey);
  const monday = addDaysToDateKey(anchorDateKey, -offset);
  return Array.from({ length: 7 }, (_, idx) => addDaysToDateKey(monday, idx));
}

export function getMonthCalendarCells(year: number, month1Based: number): Array<{
  dateKey: string;
  day: number;
  inMonth: boolean;
}> {
  const firstKey = `${year}-${String(month1Based).padStart(2, '0')}-01`;
  const leading = getWeekdayIndexMonFirst(firstKey);
  const daysInMonth = new Date(Date.UTC(year, month1Based, 0)).getUTCDate();
  const totalCells = Math.ceil((leading + daysInMonth) / 7) * 7;

  return Array.from({ length: totalCells }, (_, i) => {
    const dayOffset = i - leading;
    const dateKey = addDaysToDateKey(firstKey, dayOffset);
    const [cy, cm, cd] = dateKey.split('-').map(Number);
    return {
      dateKey,
      day: cd,
      inMonth: cy === year && cm === month1Based,
    };
  });
}

export function formatShortVNDate(dateKey: string): string {
  const [, m, d] = dateKey.split('-');
  return `${d}/${m}`;
}

export function formatFullVNDate(dateKey: string): string {
  const [y, m, d] = dateKey.split('-');
  return `${d}/${m}/${y}`;
}

export function getShortWeekdayVN(dateKey: string): string {
  const labels = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
  return labels[getWeekdayIndexMonFirst(dateKey)] ?? '';
}

export function doTimeRangesOverlap(
  startA: number,
  endA: number,
  startB: number,
  endB: number,
): boolean {
  if (endA <= startA || endB <= startB) return false;
  return startA < endB && startB < endA;
}
