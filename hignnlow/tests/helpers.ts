import type { HourlyKline } from "@/src/types/market";

const HOUR_MS = 3_600_000;

export function makeDay(
  date: string,
  highHour = 6,
  lowHour = 23,
): HourlyKline[] {
  const start = Date.parse(`${date}T00:00:00.000Z`);
  return Array.from({ length: 24 }, (_, hour) => ({
    openTime: start + hour * HOUR_MS,
    open: "100.00000000",
    high: hour === highHour ? "250.00000000" : "200.00000000",
    low: hour === lowHour ? "25.00000000" : "50.00000000",
    close: "120.00000000",
    closeTime: start + (hour + 1) * HOUR_MS - 1,
  }));
}

export function toBinanceRows(klines: HourlyKline[]): unknown[][] {
  return klines.map((kline) => [
    kline.openTime,
    kline.open,
    kline.high,
    kline.low,
    kline.close,
    "1",
    kline.closeTime,
    "1",
    1,
    "1",
    "1",
    "0",
  ]);
}
