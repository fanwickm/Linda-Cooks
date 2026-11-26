// Next date for an occasion's dateRule (see src/data/occasions.json).
export type DateRule =
  | { month: number; day: number }
  | { month: number; nthWeekday: { n: number; weekday: number } }
  | { easter: true }
  | { weekly: number };

function easterSunday(y: number): Date {
  // Anonymous Gregorian algorithm
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(y, month - 1, day);
}

function inYear(rule: any, y: number): Date {
  if (rule.easter) return easterSunday(y);
  if (rule.nthWeekday) {
    const first = new Date(y, rule.month - 1, 1);
    const offset = (rule.nthWeekday.weekday - first.getDay() + 7) % 7;
    return new Date(y, rule.month - 1, 1 + offset + (rule.nthWeekday.n - 1) * 7);
  }
  return new Date(y, rule.month - 1, rule.day);
}

export function nextDate(rule: any, from = new Date()): Date {
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  if (typeof rule.weekly === "number") {
    const d = new Date(today);
    d.setDate(d.getDate() + ((rule.weekly - d.getDay() + 7) % 7));
    return d;
  }
  let d = inYear(rule, today.getFullYear());
  if (d < today) d = inYear(rule, today.getFullYear() + 1);
  return d;
}

export function daysUntil(d: Date, from = new Date()): number {
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  return Math.round((d.getTime() - today.getTime()) / 86_400_000);
}
