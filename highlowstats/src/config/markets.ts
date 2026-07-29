export const MARKETS = [
  { symbol: "BTCUSDT", asset: "BTC", mark: "₿" },
  { symbol: "ETHUSDT", asset: "ETH", mark: "Ξ" },
  { symbol: "SOLUSDT", asset: "SOL", mark: "◎" },
  { symbol: "HYPEUSDT", asset: "HYPE", mark: "H" },
  { symbol: "XRPUSDT", asset: "XRP", mark: "X" },
  { symbol: "DOGEUSDT", asset: "DOGE", mark: "Ð" },
  { symbol: "ZECUSDT", asset: "ZEC", mark: "Z" },
  { symbol: "BNBUSDT", asset: "BNB", mark: "B" },
] as const;

export type MarketSymbol = (typeof MARKETS)[number]["symbol"];

export const RANGE_PRESETS = [
  "7d",
  "30d",
  "90d",
  "1y",
  "2y",
  "3y",
  "all",
] as const;

export type RangePreset = (typeof RANGE_PRESETS)[number];

export const RANGE_PRESET_DAYS: Record<
  Exclude<RangePreset, "all">,
  number
> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "1y": 365,
  "2y": 730,
  "3y": 1095,
};

export const DEFAULT_RANGE_DAYS = RANGE_PRESET_DAYS["30d"];
