import {
  IndexedDbKlineCache,
  type KlineCache,
  type TimeRange,
  uncoveredRanges,
} from "@/src/data/cache";
import { BinanceFuturesProvider } from "@/src/data/providers/binance";
import type { HourlyKline } from "@/src/types/market";

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

interface ApiPage {
  klines: HourlyKline[];
  nextStartTime: number | null;
}

interface LoadOptions {
  signal?: AbortSignal;
  onProgress?: (progress: { loaded: number; total: number; fromCache: number }) => void;
  now?: number;
}

export class MarketDataClient {
  private readonly provider: BinanceFuturesProvider;

  constructor(
    private readonly cache: KlineCache = new IndexedDbKlineCache(),
    fetcher: typeof fetch = (input, init) => fetch(input, init),
  ) {
    this.provider = new BinanceFuturesProvider(fetcher, 2);
  }

  async getEarliestAvailableTime(symbol: string, signal?: AbortSignal): Promise<number> {
    return this.provider.getEarliestAvailableTime(symbol, signal);
  }

  private async fetchPage(
    symbol: string,
    range: TimeRange,
    signal?: AbortSignal,
  ): Promise<ApiPage> {
    return this.provider.getHourlyKlinesPage({
      symbol,
      startTime: range.start,
      endTime: range.end,
      signal,
    });
  }

  async getHourlyKlines(
    symbol: string,
    range: TimeRange,
    options: LoadOptions = {},
  ): Promise<HourlyKline[]> {
    const total = Math.max(0, Math.floor((range.end - range.start) / HOUR_MS) + 1);
    const coverage = await this.cache.getCoverage(symbol);
    const gaps = uncoveredRanges(range, coverage);
    const cached = await this.cache.get(symbol, range);
    let loaded = cached.length;
    options.onProgress?.({ loaded, total, fromCache: cached.length });

    const now = options.now ?? Date.now();
    const completedHistoryEnd = Math.floor(now / DAY_MS) * DAY_MS - 1;

    for (const gap of gaps) {
      let cursor: number | null = gap.start;
      while (cursor !== null && cursor <= gap.end) {
        const page = await this.fetchPage(
          symbol,
          { start: cursor, end: gap.end },
          options.signal,
        );
        await this.cache.put(symbol, page.klines);
        loaded += page.klines.length;
        options.onProgress?.({
          loaded: Math.min(loaded, total),
          total,
          fromCache: cached.length,
        });
        cursor = page.nextStartTime;
      }
      const immutableEnd = Math.min(gap.end, completedHistoryEnd);
      if (gap.start <= immutableEnd) {
        await this.cache.addCoverage(symbol, {
          start: gap.start,
          end: immutableEnd,
        });
      }
    }

    const rows = await this.cache.get(symbol, range);
    return rows.sort((a, b) => a.openTime - b.openTime);
  }
}
