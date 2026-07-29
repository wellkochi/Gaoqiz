import type {
  DailyExtremeRecord,
  DistributionPoint,
} from "@/src/types/market";
import { calculateHourlyDistribution } from "@/src/statistics/calculate";
import { parseUtcDate } from "@/src/utils/utc";

const HOUR_MS = 3_600_000;

function clock(time: number, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(time));
  const hour = parts.find((part) => part.type === "hour")?.value ?? "00";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";
  return `${hour}:${minute}`;
}

export function formatZonedHourBucket(
  date: string,
  utcHour: number,
  timeZone: string,
): string {
  const start = parseUtcDate(date) + utcHour * HOUR_MS;
  return `${clock(start, timeZone)}–${clock(start + HOUR_MS, timeZone)}`;
}

function startMinute(bucket: string): number {
  const [hour, minute] = bucket.slice(0, 5).split(":").map(Number);
  return hour * 60 + minute;
}

export function calculateDisplayDistribution(
  records: DailyExtremeRecord[],
  timeZone: string,
  referenceDate: string,
): DistributionPoint[] {
  if (timeZone === "UTC") return calculateHourlyDistribution(records);

  const buckets = new Map<string, { highCount: number; lowCount: number }>();
  const sampleDates = new Set([
    referenceDate,
    records[0]?.date,
    records[Math.floor(records.length / 2)]?.date,
    records.at(-1)?.date,
  ].filter((value): value is string => Boolean(value)));

  for (const date of sampleDates) {
    for (let hour = 0; hour < 24; hour += 1) {
      const bucket = formatZonedHourBucket(date, hour, timeZone);
      if (!buckets.has(bucket)) buckets.set(bucket, { highCount: 0, lowCount: 0 });
    }
  }

  for (const record of records) {
    const highBucket = formatZonedHourBucket(record.date, record.highHour, timeZone);
    const lowBucket = formatZonedHourBucket(record.date, record.lowHour, timeZone);
    const high = buckets.get(highBucket) ?? { highCount: 0, lowCount: 0 };
    high.highCount += 1;
    buckets.set(highBucket, high);
    const low = buckets.get(lowBucket) ?? { highCount: 0, lowCount: 0 };
    low.lowCount += 1;
    buckets.set(lowBucket, low);
  }

  const denominator = records.length;
  return [...buckets.entries()]
    .sort(([a], [b]) => startMinute(a) - startMinute(b) || a.localeCompare(b))
    .map(([bucket, counts], index) => ({
      index,
      bucket,
      ...counts,
      highProbability: denominator ? (counts.highCount / denominator) * 100 : 0,
      lowProbability: denominator ? (counts.lowCount / denominator) * 100 : 0,
    }));
}
