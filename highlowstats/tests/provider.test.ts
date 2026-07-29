import { describe, expect, it, vi } from "vitest";
import {
  BINANCE_KLINES_ENDPOINT,
  BinanceFuturesProvider,
} from "@/src/data/providers/binance";
import { makeDay, toBinanceRows } from "@/tests/helpers";

describe("BinanceFuturesProvider", () => {
  it("自动分页并合并结果", async () => {
    const base = makeDay("2026-07-01")[0];
    const firstPage = Array.from({ length: 1000 }, (_, index) => ({
      ...base,
      openTime: base.openTime + index * 3_600_000,
      closeTime: base.closeTime + index * 3_600_000,
    }));
    const last = {
      ...base,
      openTime: base.openTime + 1000 * 3_600_000,
      closeTime: base.closeTime + 1000 * 3_600_000,
    };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(toBinanceRows(firstPage)), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(toBinanceRows([last])), { status: 200 }),
      );
    const provider = new BinanceFuturesProvider(fetcher, 0);
    const rows = await provider.getHourlyKlines({
      symbol: "BTCUSDT",
      startTime: base.openTime,
      endTime: last.openTime,
    });
    expect(rows).toHaveLength(1001);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[0][0]).toContain(BINANCE_KLINES_ENDPOINT);
    expect(rows.at(-1)?.openTime).toBe(last.openTime);
  });

  it("API 失败后重试，并保留 Rate Limit 中文状态", async () => {
    const row = makeDay("2026-07-01").slice(0, 1);
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('{"code":-1003}', { status: 429 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify(toBinanceRows(row)), { status: 200 }),
      );
    const provider = new BinanceFuturesProvider(fetcher, 1);
    const rows = await provider.getHourlyKlines({
      symbol: "BTCUSDT",
      startTime: row[0].openTime,
      endTime: row[0].openTime,
    });
    expect(rows).toHaveLength(1);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
