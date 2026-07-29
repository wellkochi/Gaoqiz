import type { HourlyKline } from "@/src/types/market";

export interface TimeRange {
  start: number;
  end: number;
}

export interface KlineCache {
  get(symbol: string, range: TimeRange): Promise<HourlyKline[]>;
  put(symbol: string, klines: HourlyKline[]): Promise<void>;
  getCoverage(symbol: string): Promise<TimeRange[]>;
  addCoverage(symbol: string, range: TimeRange): Promise<void>;
}

export function mergeRanges(ranges: TimeRange[]): TimeRange[] {
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const result: TimeRange[] = [];
  for (const range of sorted) {
    const previous = result.at(-1);
    if (!previous || range.start > previous.end + 1) {
      result.push({ ...range });
    } else {
      previous.end = Math.max(previous.end, range.end);
    }
  }
  return result;
}

export function uncoveredRanges(target: TimeRange, coverage: TimeRange[]): TimeRange[] {
  const result: TimeRange[] = [];
  let cursor = target.start;
  for (const range of mergeRanges(coverage)) {
    if (range.end < cursor || range.start > target.end) continue;
    if (range.start > cursor) {
      result.push({ start: cursor, end: Math.min(target.end, range.start - 1) });
    }
    cursor = Math.max(cursor, range.end + 1);
    if (cursor > target.end) break;
  }
  if (cursor <= target.end) result.push({ start: cursor, end: target.end });
  return result;
}

const DB_NAME = "binance-futures-intraday-distribution";
const DB_VERSION = 1;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("klines")) {
        db.createObjectStore("klines", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("meta")) {
        db.createObjectStore("meta", { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function rowId(symbol: string, openTime: number): string {
  return `${symbol}|1h|${String(openTime).padStart(13, "0")}`;
}

export class IndexedDbKlineCache implements KlineCache {
  async get(symbol: string, range: TimeRange): Promise<HourlyKline[]> {
    if (typeof indexedDB === "undefined") return [];
    const db = await openDatabase();
    const transaction = db.transaction("klines", "readonly");
    const store = transaction.objectStore("klines");
    const rows = await requestPromise<{ id: string; value: HourlyKline }[]>(
      store.getAll(
        IDBKeyRange.bound(rowId(symbol, range.start), rowId(symbol, range.end)),
      ),
    );
    db.close();
    return rows.map((row) => row.value).sort((a, b) => a.openTime - b.openTime);
  }

  async put(symbol: string, klines: HourlyKline[]): Promise<void> {
    if (typeof indexedDB === "undefined" || klines.length === 0) return;
    const db = await openDatabase();
    const transaction = db.transaction("klines", "readwrite");
    const store = transaction.objectStore("klines");
    for (const kline of klines) {
      store.put({ id: rowId(symbol, kline.openTime), value: kline });
    }
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    db.close();
  }

  async getCoverage(symbol: string): Promise<TimeRange[]> {
    if (typeof indexedDB === "undefined") return [];
    const db = await openDatabase();
    const transaction = db.transaction("meta", "readonly");
    const row = await requestPromise<{ key: string; ranges: TimeRange[] } | undefined>(
      transaction.objectStore("meta").get(`${symbol}|1h|coverage`),
    );
    db.close();
    return row?.ranges ?? [];
  }

  async addCoverage(symbol: string, range: TimeRange): Promise<void> {
    if (typeof indexedDB === "undefined") return;
    const previous = await this.getCoverage(symbol);
    const db = await openDatabase();
    const transaction = db.transaction("meta", "readwrite");
    transaction.objectStore("meta").put({
      key: `${symbol}|1h|coverage`,
      ranges: mergeRanges([...previous, range]),
    });
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    db.close();
  }
}

export class MemoryKlineCache implements KlineCache {
  private readonly rows = new Map<string, HourlyKline>();
  private readonly coverage = new Map<string, TimeRange[]>();

  async get(symbol: string, range: TimeRange): Promise<HourlyKline[]> {
    return [...this.rows.entries()]
      .filter(
        ([key, row]) =>
          key.startsWith(`${symbol}|`) &&
          row.openTime >= range.start &&
          row.openTime <= range.end,
      )
      .map(([, row]) => row)
      .sort((a, b) => a.openTime - b.openTime);
  }

  async put(symbol: string, klines: HourlyKline[]): Promise<void> {
    for (const kline of klines) this.rows.set(`${symbol}|${kline.openTime}`, kline);
  }

  async getCoverage(symbol: string): Promise<TimeRange[]> {
    return this.coverage.get(symbol) ?? [];
  }

  async addCoverage(symbol: string, range: TimeRange): Promise<void> {
    this.coverage.set(
      symbol,
      mergeRanges([...(this.coverage.get(symbol) ?? []), range]),
    );
  }
}
