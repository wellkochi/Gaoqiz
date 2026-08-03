"use client";

import { useMemo, useState } from "react";
import { DistributionChart } from "@/src/components/DistributionChart";
import { copy, replaceTokens, type Language } from "@/src/i18n";
import type {
  DistributionPoint,
  MonthlyStatisticsResult,
} from "@/src/types/market";

type ChartMode = "high" | "low" | "combined";
type MonthlyDimension = "day" | "week";

function peakLabels(
  distribution: DistributionPoint[],
  key: "highProbability" | "lowProbability",
  language: Language,
) {
  if (!distribution.some((point) => point.highCount || point.lowCount)) {
    return { buckets: "—", probability: "—" };
  }
  const max = Math.max(...distribution.map((point) => point[key]));
  return {
    buckets: distribution
      .filter((point) => point[key] === max)
      .map((point) => point.bucket)
      .join(language === "zh" ? "、" : ", "),
    probability: `${max.toFixed(2)}%`,
  };
}

function translateMonthReason(reason: string, language: Language): string {
  if (language === "zh") return reason;
  if (reason.includes("没有有效 UTC 交易日")) {
    return "No valid UTC trading day exists in the selected part of this month";
  }
  return reason;
}

export function MonthlySection({
  result,
  language,
  ready,
}: {
  result: MonthlyStatisticsResult;
  language: Language;
  ready: boolean;
}) {
  const [dimension, setDimension] = useState<MonthlyDimension>("day");
  const [mode, setMode] = useState<ChartMode>("high");
  const t = copy[language];
  const distribution = useMemo(() => {
    const source =
      dimension === "day" ? result.dayDistribution : result.weekDistribution;
    return source.map((point) => ({
      ...point,
      bucket: replaceTokens(
        dimension === "day" ? t.monthlyDayLabel : t.monthlyWeekLabel,
        dimension === "day"
          ? { day: point.index + 1 }
          : { week: point.index + 1 },
      ),
    }));
  }, [dimension, result.dayDistribution, result.weekDistribution, t]);
  const highPeak = useMemo(
    () => peakLabels(distribution, "highProbability", language),
    [distribution, language],
  );
  const lowPeak = useMemo(
    () => peakLabels(distribution, "lowProbability", language),
    [distribution, language],
  );

  return (
    <section className="monthly-section" aria-labelledby="monthly-distribution-title">
      <div className="monthly-intro">
        <p className="eyebrow">{t.monthlyEyebrow}</p>
        <h2 id="monthly-distribution-title">{t.monthlyTitle}</h2>
        <p>{t.monthlySummary}</p>
      </div>

      <div className="summary-grid monthly-summary-grid">
        <article className="summary-card">
          <span>{t.selectedMonths}</span>
          <strong>{ready ? result.selectedCalendarMonths : "—"}</strong>
          <small>{t.monthlyRangeHint} · UTC</small>
        </article>
        <article className="summary-card success-card">
          <span>{t.effectiveMonths}</span>
          <strong>{ready ? result.effectiveMonths : "—"}</strong>
          <small>{t.monthlyDenominator}</small>
        </article>
        <article className="summary-card warning-card">
          <span>{t.excludedMonths}</span>
          <strong>{ready ? result.excludedMonths.length : "—"}</strong>
          <small>{t.monthlyExcludedHint}</small>
        </article>
        <article className="summary-card peak-card high-peak">
          <span>{t.monthlyHighPeak}</span>
          <strong>{highPeak.buckets}</strong>
          <small>{highPeak.probability} {t.effectiveMonthSuffix}</small>
        </article>
        <article className="summary-card peak-card low-peak">
          <span>{t.monthlyLowPeak}</span>
          <strong>{lowPeak.buckets}</strong>
          <small>{lowPeak.probability} {t.effectiveMonthSuffix}</small>
        </article>
      </div>

      <div className="panel chart-panel monthly-chart-panel">
        <div className="asset-row dimension-row monthly-dimension-row">
          <span className="field-label">{t.dimension}</span>
          <div className="segmented" role="tablist" aria-label={t.monthlyDimensionAria}>
            <button
              className={dimension === "day" ? "active" : ""}
              onClick={() => setDimension("day")}
            >
              {t.monthlyByDay}
            </button>
            <button
              className={dimension === "week" ? "active" : ""}
              onClick={() => setDimension("week")}
            >
              {t.monthlyByWeek}
            </button>
          </div>
        </div>
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t.monthlyEyebrow}</p>
            <h2>{dimension === "day" ? t.monthlyDayTitle : t.monthlyWeekTitle}</h2>
          </div>
          <div className="chart-tabs" role="tablist" aria-label={t.monthlyChartModeAria}>
            <button className={mode === "high" ? "active" : ""} onClick={() => setMode("high")}>
              ▲ {t.high}
            </button>
            <button className={mode === "low" ? "active" : ""} onClick={() => setMode("low")}>
              ▼ {t.low}
            </button>
            <button className={mode === "combined" ? "active" : ""} onClick={() => setMode("combined")}>
              {t.combined}
            </button>
          </div>
        </div>
        <div className="chart-context">
          <span>{t.yAxis}</span>
          <span>{dimension === "day" ? t.monthlyDayAxis : t.monthlyWeekAxis}</span>
          <span className="context-spacer" />
          <span>UTC</span>
          <span>{t.chartDenominator}: {result.effectiveMonths} {t.validUtcMonths}</span>
        </div>
        <p className="timezone-note">
          {dimension === "day" ? t.monthlyDayTimeNote : t.monthlyWeekTimeNote}
        </p>
        <DistributionChart
          data={distribution}
          mode={mode}
          denominator={result.effectiveMonths}
          language={language}
          timeZoneLabel="UTC"
          hourly={false}
          period="month"
          wideBuckets={dimension === "day"}
        />
      </div>

      {ready && result.excludedMonths.length > 0 && (
        <details className="panel exclusions monthly-exclusions">
          <summary>
            {t.monthlyIntegrityTitle} · {result.excludedMonths.length} {t.excludedMonthCount}
          </summary>
          <ul>
            {result.excludedMonths.map((month) => (
              <li key={month.month}>
                <span className="mono">{month.month} · {month.rangeStart} → {month.rangeEnd}</span>
                <span>{translateMonthReason(month.reason, language)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
