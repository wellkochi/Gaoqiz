import type { Language } from "@/src/i18n";
import { formatZonedHourBucket } from "@/src/statistics/display";
import type { DailyExtremeRecord } from "@/src/types/market";

function escapeCsv(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function dailyRecordsToCsv(
  records: DailyExtremeRecord[],
  options: { language?: Language; timeZone?: string } = {},
): string {
  const language = options.language ?? "zh";
  const timeZone = options.timeZone ?? "UTC";
  const header =
    language === "zh"
      ? ["UTC 日期", "当日最高价格", "最高点小时区间", "当日最低价格", "最低点小时区间", "数据完整性"]
      : ["UTC Trading Day", "Daily High", "High Time Bucket", "Daily Low", "Low Time Bucket", "Data Integrity"];
  const rows = [
    header,
    ...records.map((record) => [
      record.date,
      record.high,
      formatZonedHourBucket(record.date, record.highHour, timeZone),
      record.low,
      formatZonedHourBucket(record.date, record.lowHour, timeZone),
      record.complete
        ? language === "zh" ? "完整" : "Complete"
        : language === "zh"
          ? `进行中（${record.candleCount} 根）`
          : `Live (${record.candleCount} candles)`,
    ]),
  ];
  return `\uFEFF${rows.map((row) => row.map(escapeCsv).join(",")).join("\n")}`;
}
