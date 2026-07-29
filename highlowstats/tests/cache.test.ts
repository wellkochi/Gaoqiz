import { describe, expect, it, vi } from "vitest";
import { MemoryKlineCache, mergeRanges, uncoveredRanges } from "@/src/data/cache";
import { MarketDataClient } from "@/src/services/market-data-client";
import { makeDay, toBinanceRows } from "@/tests/helpers";

describe("K 线缓存", () => {
  it("合并覆盖范围并计算缺口", () => {
    expect(
      mergeRanges([
        { start: 0, end: 9 },
        { start: 10, end: 20 },
        { start: 30, end: 40 },
      ]),
    ).toEqual([
      { start: 0, end: 20 },
      { start: 30, end: 40 },
    ]);
    expect(uncoveredRanges({ start: 0, end: 40 }, [{ start: 10, end: 30 }])).toEqual([
      { start: 0, end: 9 },
      { start: 31, end: 40 },
    ]);
  });

  it("缓存命中后不重复请求", async () => {
    const klines = makeDay("2026-07-01");
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(toBinanceRows(klines)), { status: 200 }),
    );
    const cache = new MemoryKlineCache();
    const client = new MarketDataClient(cache, fetcher);
    const range = {
      start: klines[0].openTime,
      end: klines.at(-1)!.openTime,
    };
    await client.getHourlyKlines("BTCUSDT", range, {
      now: Date.parse("2026-07-10T00:00:00Z"),
    });
    await client.getHourlyKlines("BTCUSDT", range, {
      now: Date.parse("2026-07-10T00:00:00Z"),
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
