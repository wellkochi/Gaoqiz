"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DailyTable } from "@/src/components/DailyTable";
import { DistributionChart } from "@/src/components/DistributionChart";
import { WeeklySection } from "@/src/components/WeeklySection";
import {
  DEFAULT_RANGE_DAYS,
  MARKETS,
  RANGE_PRESETS,
  RANGE_PRESET_DAYS,
  type MarketSymbol,
  type RangePreset,
} from "@/src/config/markets";
import {
  BinanceProviderError,
} from "@/src/data/providers/binance";
import {
  copy,
  replaceTokens,
  translateExcludedReason,
  type Language,
} from "@/src/i18n";
import { MarketDataClient } from "@/src/services/market-data-client";
import {
  calculateSessionDistribution,
  calculateStatistics,
  calculateWeeklyStatistics,
  filterDailyRecordsByUtcWeekday,
} from "@/src/statistics/calculate";
import { calculateDisplayDistribution } from "@/src/statistics/display";
import type {
  DistributionPoint,
  StatisticsResult,
  WeeklyStatisticsResult,
} from "@/src/types/market";
import {
  completedUtcDate,
  currentUtcDate,
  dateRangeToTimestamps,
  formatUtcDate,
  shiftUtcDate,
} from "@/src/utils/utc";
import {
  DEVICE_TIME_REFRESH_INTERVAL_MS,
  getDeviceLocalTimeHighlight,
  type DeviceTimeHighlight,
} from "@/src/utils/device-time";

type ChartMode = "high" | "low" | "combined";
type DisplayZone = "UTC" | "local";
type DistributionDimension = "hour" | "session";

const client = new MarketDataClient();
const defaultEnd = completedUtcDate();
const defaultStart = shiftUtcDate(defaultEnd, -(DEFAULT_RANGE_DAYS - 1));
const emptyWeeklyResult: WeeklyStatisticsResult = {
  selectedCalendarWeeks: 0,
  effectiveWeeks: 0,
  records: [],
  excludedWeeks: [],
  distribution: [],
};

function peakLabels(
  distribution: DistributionPoint[],
  key: "highProbability" | "lowProbability",
  language: Language,
) {
  if (!distribution.some((point) => point.highCount || point.lowCount)) {
    return { hours: "—", probability: "—" };
  }
  const max = Math.max(...distribution.map((point) => point[key]));
  const hours = distribution
    .filter((point) => point[key] === max)
    .map((point) => point.bucket)
    .join(language === "zh" ? "、" : ", ");
  return { hours, probability: `${max.toFixed(2)}%` };
}

function providerErrorMessage(
  cause: unknown,
  language: Language,
  symbol: MarketSymbol,
): string {
  const t = copy[language];
  if (!(cause instanceof BinanceProviderError)) {
    return cause instanceof Error ? cause.message : t.errors.loadFailed;
  }
  switch (cause.code) {
    case "rate_limit":
      return t.errors.rateLimit;
    case "http":
      return replaceTokens(t.errors.http, { status: cause.status ?? "—" });
    case "invalid_response":
    case "invalid_kline":
      return t.errors.invalidResponse;
    case "no_data":
      return replaceTokens(t.errors.noSymbolData, { symbol });
    default:
      return t.errors.network;
  }
}

export function Dashboard() {
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [activePreset, setActivePreset] = useState<RangePreset | null>("30d");
  const [includeCurrent, setIncludeCurrent] = useState(false);
  const [symbol, setSymbol] = useState<MarketSymbol>("BTCUSDT");
  const [language, setLanguage] = useState<Language>("zh");
  const [displayZone, setDisplayZone] = useState<DisplayZone>("UTC");
  const [localTimeZone, setLocalTimeZone] = useState("UTC");
  const [result, setResult] = useState<StatisticsResult | null>(null);
  const [chartMode, setChartMode] = useState<ChartMode>("high");
  const [dimension, setDimension] = useState<DistributionDimension>("hour");
  const [weekdayFilterEnabled, setWeekdayFilterEnabled] = useState(false);
  const [deviceTimeHighlight, setDeviceTimeHighlight] =
    useState<DeviceTimeHighlight | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingEarliest, setLoadingEarliest] = useState(false);
  const [progress, setProgress] = useState({ loaded: 0, total: 0, fromCache: 0 });
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const earliestRef = useRef(new Map<MarketSymbol, number>());
  const preferencesReadyRef = useRef(false);

  const t = copy[language];
  const activeMarket = MARKETS.find((market) => market.symbol === symbol) ?? MARKETS[0];
  const timeZone = displayZone === "local" ? localTimeZone : "UTC";
  const timeZoneLabel = displayZone === "local" ? localTimeZone : "UTC";
  const currentWeekdayIndex = deviceTimeHighlight?.weekdayIndex ?? 0;
  const currentWeekdayLabel = t.weekdays[currentWeekdayIndex];
  const distributionRecords = useMemo(() => {
    const records = result?.records ?? [];
    return weekdayFilterEnabled
      ? filterDailyRecordsByUtcWeekday(records, currentWeekdayIndex)
      : records;
  }, [currentWeekdayIndex, result, weekdayFilterEnabled]);

  const distribution = useMemo(() => {
    return dimension === "session"
      ? calculateSessionDistribution(distributionRecords)
      : calculateDisplayDistribution(
          distributionRecords,
          timeZone,
          result?.records.at(-1)?.date ?? endDate,
        );
  }, [dimension, distributionRecords, endDate, result, timeZone]);
  const weeklyResult = useMemo(
    () =>
      startDate <= endDate
        ? calculateWeeklyStatistics(result?.records ?? [], startDate, endDate)
        : emptyWeeklyResult,
    [endDate, result, startDate],
  );
  const highPeak = useMemo(
    () => peakLabels(distribution, "highProbability", language),
    [distribution, language],
  );
  const lowPeak = useMemo(
    () => peakLabels(distribution, "lowProbability", language),
    [distribution, language],
  );
  const highlightedDistributionIndexes = useMemo(() => {
    if (!deviceTimeHighlight) return [];
    if (dimension === "session") {
      return [deviceTimeHighlight.sessionIndex];
    }
    const localHourPrefix = `${String(deviceTimeHighlight.hourIndex).padStart(2, "0")}:`;
    return distribution
      .filter((point) => point.bucket.startsWith(localHourPrefix))
      .map((point) => point.index);
  }, [deviceTimeHighlight, dimension, distribution]);

  const run = useCallback(
    async (
      rangeStart = startDate,
      rangeEnd = endDate,
      include = includeCurrent,
      marketSymbol = symbol,
    ) => {
      const currentCopy = copy[language];
      if (rangeStart > rangeEnd) {
        setError(currentCopy.errors.invalidRange);
        return;
      }
      const today = currentUtcDate();
      if (!include && rangeEnd >= today) {
        setError(currentCopy.errors.currentDay);
        return;
      }
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      setError(null);
      setProgress({ loaded: 0, total: 0, fromCache: 0 });
      try {
        const cachedEarliest = earliestRef.current.get(marketSymbol);
        const earliestTime =
          cachedEarliest ??
          (await client.getEarliestAvailableTime(marketSymbol, controller.signal));
        earliestRef.current.set(marketSymbol, earliestTime);
        const earliestDate = formatUtcDate(earliestTime);
        if (rangeStart < earliestDate) {
          setError(
            replaceTokens(currentCopy.errors.earliest, {
              symbol: marketSymbol,
              date: earliestDate,
            }),
          );
          return;
        }
        const range = dateRangeToTimestamps(rangeStart, rangeEnd, include);
        const klines = await client.getHourlyKlines(
          marketSymbol,
          { start: range.startTime, end: range.endTime },
          { signal: controller.signal, onProgress: setProgress },
        );
        const statistics = calculateStatistics(klines, rangeStart, rangeEnd, {
          includeCurrentDay: include,
        });
        setResult(statistics);
        setLastUpdated(Date.now());
        if (!statistics.effectiveDays) setError(currentCopy.errors.noCompleteDays);
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setError(providerErrorMessage(cause, language, marketSymbol));
      } finally {
        if (abortRef.current === controller) setLoading(false);
      }
    },
    [endDate, includeCurrent, language, startDate, symbol],
  );

  useEffect(() => {
    const updateDeviceTime = () => {
      setDeviceTimeHighlight(getDeviceLocalTimeHighlight(new Date()));
    };
    updateDeviceTime();
    const clockTimer = window.setInterval(
      updateDeviceTime,
      DEVICE_TIME_REFRESH_INTERVAL_MS,
    );
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") updateDeviceTime();
    };
    window.addEventListener("focus", updateDeviceTime);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    const timer = window.setTimeout(() => {
      const detectedZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      const savedLanguage = window.localStorage.getItem("intraday-language");
      const savedZone = window.localStorage.getItem("intraday-display-zone");
      preferencesReadyRef.current = true;
      setLocalTimeZone(detectedZone);
      if (savedLanguage === "zh" || savedLanguage === "en") setLanguage(savedLanguage);
      if (savedZone === "UTC" || savedZone === "local") setDisplayZone(savedZone);
      void run(defaultStart, defaultEnd, false, "BTCUSDT");
    }, 0);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(clockTimer);
      window.removeEventListener("focus", updateDeviceTime);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
    if (preferencesReadyRef.current) {
      window.localStorage.setItem("intraday-language", language);
    }
  }, [language]);

  useEffect(() => {
    if (preferencesReadyRef.current) {
      window.localStorage.setItem("intraday-display-zone", displayZone);
    }
  }, [displayZone]);

  async function applyPreset(preset: RangePreset) {
    setActivePreset(preset);
    const end = includeCurrent ? currentUtcDate() : completedUtcDate();
    let start: string;
    if (preset === "all") {
      setLoadingEarliest(true);
      setError(null);
      try {
        const earliest =
          earliestRef.current.get(symbol) ??
          (await client.getEarliestAvailableTime(symbol));
        earliestRef.current.set(symbol, earliest);
        start = formatUtcDate(earliest);
      } catch (cause) {
        setError(providerErrorMessage(cause, language, symbol));
        setLoadingEarliest(false);
        return;
      }
      setLoadingEarliest(false);
    } else {
      const days = RANGE_PRESET_DAYS[preset];
      start = shiftUtcDate(end, -(days - 1));
    }
    setStartDate(start);
    setEndDate(end);
  }

  function selectMarket(nextSymbol: MarketSymbol) {
    if (nextSymbol === symbol) return;
    setSymbol(nextSymbol);
    setResult(null);
    setLastUpdated(null);
    void run(startDate, endDate, includeCurrent, nextSymbol);
  }

  function setCustomDate(setter: (value: string) => void, value: string) {
    setActivePreset(null);
    setter(value);
  }

  function toggleCurrent(value: boolean) {
    setIncludeCurrent(value);
    if (value && endDate === completedUtcDate()) setEndDate(currentUtcDate());
    if (!value && endDate >= currentUtcDate()) setEndDate(completedUtcDate());
  }

  const percent = progress.total
    ? Math.min(100, (progress.loaded / progress.total) * 100)
    : 0;
  const updatedLabel = lastUpdated
    ? new Intl.DateTimeFormat(t.locale, {
        timeZone,
        dateStyle: "medium",
        timeStyle: "medium",
      }).format(new Date(lastUpdated))
    : t.waiting;

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label={t.homeAria}>
          <span className="brand-mark" aria-hidden="true">{activeMarket.mark}</span>
          <span>
            <strong>{activeMarket.asset} Intraday</strong>
            <small>High / Low Distribution</small>
          </span>
        </a>
        <div className="market-meta" aria-label={t.marketParameters}>
          <span><i className="status-dot" /> Binance Futures</span>
          <span>{symbol}</span>
          <span title={displayZone === "local" ? `${t.deviceZone}: ${localTimeZone}` : "UTC"}>
            {timeZoneLabel}
          </span>
          <span>1h</span>
        </div>
        <div className="header-actions">
          <div className="preference-controls">
            <div className="mini-toggle" aria-label={t.displayTime}>
              <button
                className={displayZone === "UTC" ? "active" : ""}
                onClick={() => setDisplayZone("UTC")}
              >
                UTC
              </button>
              <button
                className={displayZone === "local" ? "active" : ""}
                onClick={() => setDisplayZone("local")}
                title={`${t.deviceZone}: ${localTimeZone}`}
              >
                {t.local}
              </button>
            </div>
            <div className="mini-toggle" aria-label={t.language}>
              <button
                className={language === "zh" ? "active" : ""}
                onClick={() => setLanguage("zh")}
              >
                中
              </button>
              <button
                className={language === "en" ? "active" : ""}
                onClick={() => setLanguage("en")}
              >
                EN
              </button>
            </div>
          </div>
          <div className="updated">
            <span>{t.lastUpdated}</span>
            <strong>{updatedLabel}</strong>
          </div>
        </div>
      </header>

      <div className="shell" id="top">
        <section className="hero">
          <div>
            <p className="eyebrow">MARKET MICROSTRUCTURE · {symbol}</p>
            <h1>
              {language === "zh"
                ? `${activeMarket.asset} 高低点，`
                : `When does ${activeMarket.asset}`}<br />
              <em>
                {language === "zh"
                  ? "通常出现在哪个小时、星期？"
                  : "set its daily and weekly extremes?"}
              </em>
            </h1>
            <p className="hero-copy">
              {language === "zh"
                ? `基于 Binance Futures ${symbol} 的 1 小时 K 线，同时统计日内小时分布与周内星期分布。`
                : `Using Binance Futures ${symbol} hourly candles, this app measures both intraday hour and weekly weekday distributions.`}
            </p>
          </div>
          <aside className="utc-rule">
            <span>UTC TRADING DAY</span>
            <strong>00:00 → 00:00</strong>
            <p>
              {language === "zh"
                ? "统计边界固定为 UTC · 显示时间可切换"
                : "UTC boundaries · switchable display time"}
            </p>
          </aside>
        </section>

        <section className="control-panel" aria-label={t.marketParameters}>
          <div className="asset-row">
            <span className="field-label">{t.asset}</span>
            <div className="segmented asset-segmented">
              {MARKETS.map((market) => (
                <button
                  key={market.symbol}
                  className={symbol === market.symbol ? "active" : ""}
                  onClick={() => selectMarket(market.symbol)}
                  disabled={loadingEarliest}
                >
                  <span aria-hidden="true">{market.mark}</span> {market.asset}
                  <small>{market.symbol}</small>
                </button>
              ))}
            </div>
          </div>
          <div className="preset-row">
            <span className="field-label">{t.quickRange}</span>
            <div className="segmented">
              {RANGE_PRESETS.map((value) => (
                <button
                  key={value}
                  className={activePreset === value ? "active" : ""}
                  onClick={() => void applyPreset(value)}
                  disabled={loading || loadingEarliest}
                >
                  {value === "all" && loadingEarliest
                    ? t.presets.loading
                    : t.presets[value]}
                </button>
              ))}
            </div>
          </div>
          <div className="date-controls">
            <label>
              <span>{t.startDate}</span>
              <input
                type="date"
                value={startDate}
                onChange={(event) => setCustomDate(setStartDate, event.target.value)}
              />
            </label>
            <span className="date-arrow" aria-hidden="true">→</span>
            <label>
              <span>{t.endDate}</span>
              <input
                type="date"
                value={endDate}
                onChange={(event) => setCustomDate(setEndDate, event.target.value)}
              />
            </label>
            <label className="current-toggle">
              <input
                type="checkbox"
                checked={includeCurrent}
                onChange={(event) => toggleCurrent(event.target.checked)}
              />
              <span>
                {t.includeCurrent}
                <small>{t.changingData}</small>
              </span>
            </label>
            {loading ? (
              <button
                className="primary-button cancel-button"
                onClick={() => abortRef.current?.abort()}
              >
                ■ {t.cancel}
              </button>
            ) : (
              <button className="primary-button" onClick={() => void run()}>
                {t.start} <span aria-hidden="true">→</span>
              </button>
            )}
          </div>
          {loading && (
            <div className="progress-block" aria-live="polite">
              <div className="progress-copy">
                <span>{t.loading}</span>
                <strong>
                  {t.loaded} {progress.loaded.toLocaleString(t.locale)} /{" "}
                  {progress.total.toLocaleString(t.locale)} {t.candles}
                  {progress.fromCache > 0 &&
                    ` · ${t.cacheHit} ${progress.fromCache.toLocaleString(t.locale)}`}
                </strong>
              </div>
              <div className="progress-track"><i style={{ width: `${percent}%` }} /></div>
            </div>
          )}
          {error && (
            <div className="error-banner" role="alert">
              <strong>{t.errorTitle}</strong><span>{error}</span>
            </div>
          )}
        </section>

        <section className="summary-grid" aria-label={language === "zh" ? "统计摘要" : "Summary"}>
          <article className="summary-card">
            <span>{t.selectedDays}</span>
            <strong>{result?.selectedCalendarDays ?? "—"}</strong>
            <small>{startDate} → {endDate}</small>
          </article>
          <article className="summary-card success-card">
            <span>{t.effectiveDays}</span>
            <strong>{result?.effectiveDays ?? "—"}</strong>
            <small>{t.denominator}</small>
          </article>
          <article className="summary-card warning-card">
            <span>{t.excludedDays}</span>
            <strong>{result?.excludedDays.length ?? "—"}</strong>
            <small>{t.excludedHint}</small>
          </article>
          <article className="summary-card peak-card high-peak">
            <span>{t.highPeak}</span>
            <strong>{highPeak.hours}</strong>
            <small>
              {highPeak.probability}{" "}
              {weekdayFilterEnabled ? t.matchingDaySuffix : t.effectiveDaySuffix}
            </small>
          </article>
          <article className="summary-card peak-card low-peak">
            <span>{t.lowPeak}</span>
            <strong>{lowPeak.hours}</strong>
            <small>
              {lowPeak.probability}{" "}
              {weekdayFilterEnabled ? t.matchingDaySuffix : t.effectiveDaySuffix}
            </small>
          </article>
        </section>

        <section className="panel chart-panel" aria-labelledby="distribution-title">
          <div className="asset-row dimension-row">
            <span className="field-label">{t.dimension}</span>
            <div className="segmented">
              <button
                className={dimension === "hour" ? "active" : ""}
                onClick={() => setDimension("hour")}
              >
                {t.hourly}
              </button>
              <button
                className={dimension === "session" ? "active" : ""}
                onClick={() => setDimension("session")}
              >
                {t.session}
              </button>
            </div>
            <button
              type="button"
              className={`weekday-filter-button${weekdayFilterEnabled ? " active" : ""}`}
              aria-label={t.weekdayFilterAria}
              aria-pressed={weekdayFilterEnabled}
              title={t.weekdayFilterHelp}
              onClick={() => setWeekdayFilterEnabled((enabled) => !enabled)}
            >
              <span className="weekday-switch-track" aria-hidden="true"><i /></span>
              <span className="weekday-filter-copy">
                <strong>{t.weekdayFilter}</strong>
                <small>
                  {weekdayFilterEnabled
                    ? replaceTokens(t.weekdayFilterOn, { weekday: currentWeekdayLabel })
                    : t.weekdayFilterOff}
                </small>
              </span>
            </button>
          </div>
          <div className="section-heading">
            <div>
              <p className="eyebrow">{t.chartEyebrow}</p>
              <h2 id="distribution-title">
                {dimension === "hour" ? t.chartTitle : t.sessionTitle}
              </h2>
            </div>
            <div className="chart-tabs" role="tablist" aria-label={language === "zh" ? "图表模式" : "Chart mode"}>
              <button className={chartMode === "high" ? "active" : ""} onClick={() => setChartMode("high")}>
                ▲ {t.high}
              </button>
              <button className={chartMode === "low" ? "active" : ""} onClick={() => setChartMode("low")}>
                ▼ {t.low}
              </button>
              <button className={chartMode === "combined" ? "active" : ""} onClick={() => setChartMode("combined")}>
                {t.combined}
              </button>
            </div>
          </div>
          <div className="chart-context">
            <span>{t.yAxis}</span>
            <span>{dimension === "hour" ? t.xAxis : t.sessionAxis}</span>
            <span className="context-spacer" />
            <span>{dimension === "hour" ? timeZoneLabel : "UTC"}</span>
            <span>
              {t.chartDenominator}: {distributionRecords.length}{" "}
              {weekdayFilterEnabled ? t.matchingUtcDays : t.validUtcDays}
            </span>
          </div>
          <p className="timezone-note">
            {dimension === "hour" ? t.displayTimeNote : t.sessionTimeNote}
          </p>
          {weekdayFilterEnabled && (
            <p className="weekday-filter-note" role="status">
              {replaceTokens(t.weekdayFilterNote, {
                weekday: currentWeekdayLabel,
                count: distributionRecords.length,
              })}
            </p>
          )}
          <DistributionChart
            data={distribution}
            mode={chartMode}
            denominator={distributionRecords.length}
            language={language}
            timeZoneLabel={dimension === "hour" ? timeZoneLabel : "UTC"}
            hourly={dimension === "hour"}
            highlightedIndexes={highlightedDistributionIndexes}
          />
        </section>

        <DailyTable
          records={result?.records ?? []}
          symbol={symbol}
          language={language}
          timeZone={timeZone}
          timeZoneLabel={timeZoneLabel}
        />

        {result && result.excludedDays.length > 0 && (
          <details className="panel exclusions">
            <summary>
              {t.integrityTitle} · {result.excludedDays.length} {t.excludedCount}
            </summary>
            <ul>
              {result.excludedDays.map((day) => (
                <li key={day.date}>
                  <span className="mono">{day.date}</span>
                  <span>{translateExcludedReason(day.reason, language)}</span>
                </li>
              ))}
            </ul>
          </details>
          )}

        <WeeklySection
          result={weeklyResult}
          language={language}
          ready={Boolean(result)}
          highlightedWeekdayIndex={deviceTimeHighlight?.weekdayIndex ?? null}
        />

        <section className="method-grid" aria-labelledby="method-title">
          <div>
            <p className="eyebrow">{t.methodology}</p>
            <h2 id="method-title">{t.methodTitle}</h2>
            <p>{t.methodSummary}</p>
          </div>
          <ol>
            {t.methods.map(([title, description], index) => (
              <li key={title}>
                <strong>{String(index + 1).padStart(2, "0")}</strong>
                <span><b>{title}</b>{description}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>
      <footer>
        <span>{activeMarket.asset} High/Low Distribution</span>
        <span>Data: Binance Futures · {symbol} · 1h · UTC day + week / {timeZoneLabel} display</span>
        <span>{t.footerResearch}</span>
      </footer>
    </main>
  );
}
