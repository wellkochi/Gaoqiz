import Decimal from "decimal.js";
import type {
  DailyExtremeRecord,
  DistributionPoint,
  ExcludedDay,
  ExcludedWeek,
  HourlyKline,
  StatisticsResult,
  WeeklyExtremeRecord,
  WeeklyStatisticsResult,
} from "@/src/types/market";
import {
  currentUtcDate,
  formatUtcDate,
  formatUtcHourBucket,
  shiftUtcDate,
  utcDateRange,
  utcWeekdayIndex,
  utcWeekStartsInRange,
} from "@/src/utils/utc";

const HOUR_MS = 3_600_000;

function validPrice(value: string): boolean {
  try {
    const price = new Decimal(value);
    return price.isFinite() && price.greaterThanOrEqualTo(0);
  } catch {
    return false;
  }
}

export function isValidKline(kline: HourlyKline): boolean {
  return (
    Number.isInteger(kline.openTime) &&
    kline.openTime % HOUR_MS === 0 &&
    Number.isInteger(kline.closeTime) &&
    kline.closeTime >= kline.openTime &&
    validPrice(kline.open) &&
    validPrice(kline.high) &&
    validPrice(kline.low) &&
    validPrice(kline.close) &&
    new Decimal(kline.high).greaterThanOrEqualTo(kline.low)
  );
}

export function dedupeKlines(klines: HourlyKline[]): HourlyKline[] {
  const byOpenTime = new Map<number, HourlyKline>();
  for (const kline of [...klines].sort((a, b) => a.openTime - b.openTime)) {
    if (!byOpenTime.has(kline.openTime)) byOpenTime.set(kline.openTime, kline);
  }
  return [...byOpenTime.values()].sort((a, b) => a.openTime - b.openTime);
}

export function validateUtcDay(
  klines: HourlyKline[],
): { valid: true; klines: HourlyKline[] } | { valid: false; reason: string } {
  if (klines.some((kline) => !isValidKline(kline))) {
    return { valid: false, reason: "存在无法解析或不合法的 K 线字段" };
  }
  const deduped = dedupeKlines(klines);
  if (deduped.length !== 24) {
    return {
      valid: false,
      reason: `小时 K 线不完整（去重后 ${deduped.length}/24）`,
    };
  }
  const dates = new Set(deduped.map((kline) => formatUtcDate(kline.openTime)));
  const hours = new Set(deduped.map((kline) => new Date(kline.openTime).getUTCHours()));
  if (dates.size !== 1 || hours.size !== 24) {
    return { valid: false, reason: "K 线未严格覆盖同一 UTC 日的 24 个小时" };
  }
  return { valid: true, klines: deduped };
}

function calculateOneDay(
  date: string,
  klines: HourlyKline[],
  complete: boolean,
): DailyExtremeRecord {
  const sorted = [...klines].sort((a, b) => a.openTime - b.openTime);
  let high = new Decimal(sorted[0].high);
  let low = new Decimal(sorted[0].low);
  let highKline = sorted[0];
  let lowKline = sorted[0];

  for (const kline of sorted.slice(1)) {
    const candidateHigh = new Decimal(kline.high);
    const candidateLow = new Decimal(kline.low);
    if (candidateHigh.greaterThan(high)) {
      high = candidateHigh;
      highKline = kline;
    }
    if (candidateLow.lessThan(low)) {
      low = candidateLow;
      lowKline = kline;
    }
  }

  return {
    date,
    high: highKline.high,
    highHour: new Date(highKline.openTime).getUTCHours(),
    low: lowKline.low,
    lowHour: new Date(lowKline.openTime).getUTCHours(),
    complete,
    candleCount: sorted.length,
  };
}

export function calculateDailyExtremes(
  klines: HourlyKline[],
  startDate: string,
  endDate: string,
  options: { includeCurrentDay?: boolean; now?: number } = {},
): { records: DailyExtremeRecord[]; excludedDays: ExcludedDay[] } {
  const selectedDates = utcDateRange(startDate, endDate);
  const grouped = new Map<string, HourlyKline[]>();
  for (const kline of klines) {
    const date = formatUtcDate(kline.openTime);
    if (date < startDate || date > endDate) continue;
    grouped.set(date, [...(grouped.get(date) ?? []), kline]);
  }

  const records: DailyExtremeRecord[] = [];
  const excludedDays: ExcludedDay[] = [];
  const now = options.now ?? Date.now();
  const today = currentUtcDate(now);

  for (const date of selectedDates) {
    const dayKlines = grouped.get(date) ?? [];
    if (date === today && !options.includeCurrentDay) {
      excludedDays.push({ date, reason: "当前 UTC 日尚未结束，默认排除" });
      continue;
    }
    if (date === today && options.includeCurrentDay) {
      const deduped = dedupeKlines(dayKlines.filter(isValidKline));
      if (deduped.length === 0 || deduped.some((k) => formatUtcDate(k.openTime) !== date)) {
        excludedDays.push({ date, reason: "当前 UTC 日暂无可用小时 K 线" });
      } else {
        records.push(calculateOneDay(date, deduped, false));
      }
      continue;
    }
    const validation = validateUtcDay(dayKlines);
    if (!validation.valid) {
      excludedDays.push({ date, reason: validation.reason });
      continue;
    }
    records.push(calculateOneDay(date, validation.klines, true));
  }
  return { records, excludedDays };
}

export function calculateHourlyDistribution(
  records: DailyExtremeRecord[],
): DistributionPoint[] {
  const denominator = records.length;
  return Array.from({ length: 24 }, (_, hour) => {
    const highCount = records.filter((record) => record.highHour === hour).length;
    const lowCount = records.filter((record) => record.lowHour === hour).length;
    return {
      index: hour,
      bucket: formatUtcHourBucket(hour),
      highCount,
      lowCount,
      highProbability: denominator ? (highCount / denominator) * 100 : 0,
      lowProbability: denominator ? (lowCount / denominator) * 100 : 0,
    };
  });
}

export function filterDailyRecordsByUtcWeekday(
  records: DailyExtremeRecord[],
  weekdayIndex: number,
): DailyExtremeRecord[] {
  if (!Number.isInteger(weekdayIndex) || weekdayIndex < 0 || weekdayIndex > 6) {
    throw new Error("UTC 星期索引必须在 0 到 6 之间");
  }
  return records.filter((record) => utcWeekdayIndex(record.date) === weekdayIndex);
}

const UTC_SESSIONS = [
  { bucket: "Asia", start: 0, end: 6 },
  { bucket: "London", start: 6, end: 12 },
  { bucket: "New York", start: 12, end: 20 },
  { bucket: "Close", start: 20, end: 24 },
] as const;

export function calculateSessionDistribution(
  records: DailyExtremeRecord[],
): DistributionPoint[] {
  const denominator = records.length;
  return UTC_SESSIONS.map((session, index) => {
    const inSession = (hour: number) => hour >= session.start && hour < session.end;
    const highCount = records.filter((record) => inSession(record.highHour)).length;
    const lowCount = records.filter((record) => inSession(record.lowHour)).length;
    return {
      index,
      bucket: session.bucket,
      highCount,
      lowCount,
      highProbability: denominator ? (highCount / denominator) * 100 : 0,
      lowProbability: denominator ? (lowCount / denominator) * 100 : 0,
    };
  });
}

export function calculateWeeklyExtremes(
  dailyRecords: DailyExtremeRecord[],
  startDate: string,
  endDate: string,
): { records: WeeklyExtremeRecord[]; excludedWeeks: ExcludedWeek[] } {
  const byDate = new Map(dailyRecords.map((record) => [record.date, record]));
  const records: WeeklyExtremeRecord[] = [];
  const excludedWeeks: ExcludedWeek[] = [];

  for (const weekStart of utcWeekStartsInRange(startDate, endDate)) {
    const weekEnd = shiftUtcDate(weekStart, 6);
    if (weekStart < startDate || weekEnd > endDate) {
      excludedWeeks.push({
        weekStart,
        weekEnd,
        reason: "所选日期范围未完整覆盖该 UTC 周（周一至周日）",
      });
      continue;
    }

    const dates = utcDateRange(weekStart, weekEnd);
    const days = dates
      .map((date) => byDate.get(date))
      .filter((record): record is DailyExtremeRecord => Boolean(record));
    if (days.length !== 7 || days.some((record) => !record.complete)) {
      excludedWeeks.push({
        weekStart,
        weekEnd,
        reason: `UTC 周数据不完整（${days.filter((record) => record.complete).length}/7 个完整交易日）`,
      });
      continue;
    }

    let highDay = days[0];
    let lowDay = days[0];
    for (const day of days.slice(1)) {
      if (new Decimal(day.high).greaterThan(highDay.high)) highDay = day;
      if (new Decimal(day.low).lessThan(lowDay.low)) lowDay = day;
    }

    records.push({
      weekStart,
      weekEnd,
      high: highDay.high,
      highDate: highDay.date,
      highWeekday: dates.indexOf(highDay.date),
      low: lowDay.low,
      lowDate: lowDay.date,
      lowWeekday: dates.indexOf(lowDay.date),
      dayCount: days.length,
    });
  }

  return { records, excludedWeeks };
}

const WEEKDAY_BUCKETS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export function calculateWeekdayDistribution(
  records: WeeklyExtremeRecord[],
): DistributionPoint[] {
  const denominator = records.length;
  return WEEKDAY_BUCKETS.map((bucket, index) => {
    const highCount = records.filter((record) => record.highWeekday === index).length;
    const lowCount = records.filter((record) => record.lowWeekday === index).length;
    return {
      index,
      bucket,
      highCount,
      lowCount,
      highProbability: denominator ? (highCount / denominator) * 100 : 0,
      lowProbability: denominator ? (lowCount / denominator) * 100 : 0,
    };
  });
}

export function calculateWeeklyStatistics(
  dailyRecords: DailyExtremeRecord[],
  startDate: string,
  endDate: string,
): WeeklyStatisticsResult {
  const { records, excludedWeeks } = calculateWeeklyExtremes(
    dailyRecords,
    startDate,
    endDate,
  );
  return {
    selectedCalendarWeeks: utcWeekStartsInRange(startDate, endDate).length,
    effectiveWeeks: records.length,
    records,
    excludedWeeks,
    distribution: calculateWeekdayDistribution(records),
  };
}

export function calculateStatistics(
  klines: HourlyKline[],
  startDate: string,
  endDate: string,
  options: { includeCurrentDay?: boolean; now?: number } = {},
): StatisticsResult {
  const selectedCalendarDays = utcDateRange(startDate, endDate).length;
  const { records, excludedDays } = calculateDailyExtremes(
    klines,
    startDate,
    endDate,
    options,
  );
  return {
    selectedCalendarDays,
    effectiveDays: records.length,
    records,
    excludedDays,
    distribution: calculateHourlyDistribution(records),
  };
}

export function roundPercentage(value: number): string {
  return value.toFixed(2);
}
