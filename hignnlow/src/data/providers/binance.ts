import type { HourlyKline, MarketDataProvider } from "@/src/types/market";

const PAGE_LIMIT = 1000;
const HOUR_MS = 3_600_000;
export const BINANCE_KLINES_ENDPOINT = "https://fapi.binance.com/fapi/v1/klines";

export type BinanceErrorCode =
  | "rate_limit"
  | "http"
  | "invalid_response"
  | "network"
  | "invalid_kline"
  | "no_data";

export class BinanceProviderError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code: BinanceErrorCode = "network",
  ) {
    super(message);
    this.name = "BinanceProviderError";
  }
}

export interface KlinePage {
  klines: HourlyKline[];
  nextStartTime: number | null;
}

type FetchLike = typeof fetch;

export class BinanceFuturesProvider implements MarketDataProvider {
  constructor(
    private readonly fetcher: FetchLike = (input, init) => fetch(input, init),
    private readonly maxRetries = 3,
  ) {}

  private async request(params: URLSearchParams, signal?: AbortSignal): Promise<unknown[]> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      try {
        const response = await this.fetcher(`${BINANCE_KLINES_ENDPOINT}?${params}`, {
          signal,
          headers: { Accept: "application/json" },
        });
        if (!response.ok) {
          const detail = await response.text().catch(() => "");
          const error = new BinanceProviderError(
            response.status === 429
              ? "Binance 请求频率过高，请稍后重试"
              : `Binance 行情请求失败（${response.status}）${detail ? `：${detail}` : ""}`,
            response.status,
            response.status === 429 ? "rate_limit" : "http",
          );
          if (response.status !== 429 && response.status < 500) throw error;
          lastError = error;
        } else {
          const result = await response.json();
          if (!Array.isArray(result)) {
            throw new BinanceProviderError(
              "Binance 返回了异常数据结构",
              undefined,
              "invalid_response",
            );
          }
          return result;
        }
      } catch (error) {
        if (signal?.aborted) throw error;
        lastError = error;
      }
      if (attempt < this.maxRetries) {
        await new Promise((resolve) =>
          setTimeout(resolve, Math.min(4000, 300 * 2 ** attempt)),
        );
      }
    }
    if (lastError instanceof BinanceProviderError) throw lastError;
    throw new BinanceProviderError(
      "无法连接 Binance 公共行情服务，请检查网络后重试",
      undefined,
      "network",
    );
  }

  private parseRow(row: unknown): HourlyKline {
    if (!Array.isArray(row) || row.length < 7) {
      throw new BinanceProviderError(
        "Binance K 线字段不完整",
        undefined,
        "invalid_kline",
      );
    }
    return {
      openTime: Number(row[0]),
      open: String(row[1]),
      high: String(row[2]),
      low: String(row[3]),
      close: String(row[4]),
      closeTime: Number(row[6]),
    };
  }

  async getHourlyKlinesPage(params: {
    symbol: string;
    startTime: number;
    endTime: number;
    signal?: AbortSignal;
  }): Promise<KlinePage> {
    const query = new URLSearchParams({
      symbol: params.symbol.toUpperCase(),
      interval: "1h",
      startTime: String(params.startTime),
      endTime: String(params.endTime),
      limit: String(PAGE_LIMIT),
    });
    const raw = await this.request(query, params.signal);
    const klines = raw.map((row) => this.parseRow(row));
    const last = klines.at(-1);
    const next = last ? last.openTime + HOUR_MS : null;
    return {
      klines,
      nextStartTime:
        klines.length === PAGE_LIMIT && next !== null && next <= params.endTime
          ? next
          : null,
    };
  }

  async getHourlyKlines(params: {
    symbol: string;
    startTime: number;
    endTime: number;
  }): Promise<HourlyKline[]> {
    const rows: HourlyKline[] = [];
    let cursor: number | null = params.startTime;
    while (cursor !== null && cursor <= params.endTime) {
      const page = await this.getHourlyKlinesPage({ ...params, startTime: cursor });
      rows.push(...page.klines);
      cursor = page.nextStartTime;
    }
    return rows;
  }

  async getEarliestAvailableTime(
    symbol: string,
    signal?: AbortSignal,
  ): Promise<number> {
    const query = new URLSearchParams({
      symbol: symbol.toUpperCase(),
      interval: "1h",
      startTime: "0",
      limit: "1",
    });
    const raw = await this.request(query, signal);
    if (!raw.length) {
      throw new BinanceProviderError(
        `Binance 没有 ${symbol} 的历史数据`,
        undefined,
        "no_data",
      );
    }
    return this.parseRow(raw[0]).openTime;
  }
}
