const DAY_MS = 86_400_000;

export function parseUtcDate(date: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("日期格式必须为 YYYY-MM-DD");
  }
  const value = Date.parse(`${date}T00:00:00.000Z`);
  if (!Number.isFinite(value) || new Date(value).toISOString().slice(0, 10) !== date) {
    throw new Error(`无效日期：${date}`);
  }
  return value;
}

export function formatUtcDate(time: number): string {
  return new Date(time).toISOString().slice(0, 10);
}

export function shiftUtcDate(date: string, days: number): string {
  return formatUtcDate(parseUtcDate(date) + days * DAY_MS);
}

export function utcDateRange(startDate: string, endDate: string): string[] {
  const start = parseUtcDate(startDate);
  const end = parseUtcDate(endDate);
  if (start > end) throw new Error("开始日期不能晚于结束日期");
  const dates: string[] = [];
  for (let time = start; time <= end; time += DAY_MS) {
    dates.push(formatUtcDate(time));
  }
  return dates;
}

export function startOfUtcWeek(date: string): string {
  const time = parseUtcDate(date);
  const day = new Date(time).getUTCDay();
  const daysSinceMonday = (day + 6) % 7;
  return formatUtcDate(time - daysSinceMonday * DAY_MS);
}

export function utcWeekdayIndex(date: string): number {
  return (new Date(parseUtcDate(date)).getUTCDay() + 6) % 7;
}

export function utcWeekStartsInRange(startDate: string, endDate: string): string[] {
  if (parseUtcDate(startDate) > parseUtcDate(endDate)) {
    throw new Error("开始日期不能晚于结束日期");
  }
  const starts: string[] = [];
  for (
    let time = parseUtcDate(startOfUtcWeek(startDate));
    time <= parseUtcDate(endDate);
    time += 7 * DAY_MS
  ) {
    starts.push(formatUtcDate(time));
  }
  return starts;
}

export function completedUtcDate(now = Date.now()): string {
  return formatUtcDate(now - DAY_MS);
}

export function currentUtcDate(now = Date.now()): string {
  return formatUtcDate(now);
}

export function dateRangeToTimestamps(
  startDate: string,
  endDate: string,
  includeCurrentDay: boolean,
  now = Date.now(),
): { startTime: number; endTime: number } {
  const startTime = parseUtcDate(startDate);
  const nominalEnd = parseUtcDate(endDate) + DAY_MS - 1;
  const endTime = includeCurrentDay ? Math.min(nominalEnd, now) : nominalEnd;
  return { startTime, endTime };
}

export function formatUtcHourBucket(hour: number): string {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new Error("UTC 小时必须在 0 到 23 之间");
  }
  const start = String(hour).padStart(2, "0");
  const end = String((hour + 1) % 24).padStart(2, "0");
  return `${start}:00–${end}:00`;
}

export function formatShortUtcHour(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}
