"use client";

import { useMemo, useState } from "react";
import { DistributionChart } from "@/src/components/DistributionChart";
import { copy, type Language } from "@/src/i18n";
import type {
  DistributionPoint,
  WeeklyStatisticsResult,
} from "@/src/types/market";

type ChartMode = "high" | "low" | "combined";

function peakLabels(
  distribution: DistributionPoint[],
  key: "highProbability" | "lowProbability",
  language: Language,
) {
  if (!distribution.some((point) => point.highCount || point.lowCount)) {
    return { weekdays: "—", probability: "—" };
  }
  const max = Math.max(...distribution.map((point) => point[key]));
  return {
    weekdays: distribution
      .filter((point) => point[key] === max)
      .map((point) => point.bucket)
      .join(language === "zh" ? "、" : ", "),
    probability: `${max.toFixed(2)}%`,
  };
}

function translateWeekReason(reason: string, language: Language): string {
  if (language === "zh") return reason;
  if (reason.includes("未完整覆盖")) {
    return "The selected date range does not cover this full UTC week (Monday–Sunday)";
  }
  const incomplete = reason.match(/（(\d+)\/7/);
  if (incomplete) {
    return `Incomplete UTC week (${incomplete[1]}/7 complete trading days)`;
  }
  return reason;
}

export function WeeklySection({
  result,
  language,
  ready,
}: {
  result: WeeklyStatisticsResult;
  language: Language;
  ready: boolean;
}) {
  const [mode, setMode] = useState<ChartMode>("high");
  const t = copy[language];
  const distribution = useMemo(
    () =>
      result.distribution.map((point) => ({
        ...point,
        bucket: t.weekdays[point.index],
      })),
    [result.distribution, t.weekdays],
  );
  const highPeak = useMemo(
    () => peakLabels(distribution, "highProbability", language),
    [distribution, language],
  );
  const lowPeak = useMemo(
    () => peakLabels(distribution, "lowProbability", language),
    [distribution, language],
  );

  return (
    <section className="weekly-section" aria-labelledby="weekly-distribution-title">
      <div className="weekly-intro">
        <p className="eyebrow">{t.weeklyEyebrow}</p>
        <h2 id="weekly-distribution-title">{t.weeklyTitle}</h2>
        <p>{t.weeklySummary}</p>
      </div>

      <div className="summary-grid weekly-summary-grid">
        <article className="summary-card">
          <span>{t.selectedWeeks}</span>
          <strong>{ready ? result.selectedCalendarWeeks : "—"}</strong>
          <small>{language === "zh" ? "周一 → 周日" : "Monday → Sunday"} · UTC</small>
        </article>
        <article className="summary-card success-card">
          <span>{t.effectiveWeeks}</span>
          <strong>{ready ? result.effectiveWeeks : "—"}</strong>
          <small>{t.weeklyDenominator}</small>
        </article>
        <article className="summary-card warning-card">
          <span>{t.excludedWeeks}</span>
          <strong>{ready ? result.excludedWeeks.length : "—"}</strong>
          <small>{t.weeklyExcludedHint}</small>
        </article>
        <article className="summary-card peak-card high-peak">
          <span>{t.weeklyHighPeak}</span>
          <strong>{highPeak.weekdays}</strong>
          <small>{highPeak.probability} {t.effectiveWeekSuffix}</small>
        </article>
        <article className="summary-card peak-card low-peak">
          <span>{t.weeklyLowPeak}</span>
          <strong>{lowPeak.weekdays}</strong>
          <small>{lowPeak.probability} {t.effectiveWeekSuffix}</small>
        </article>
      </div>

      <div className="panel chart-panel weekly-chart-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t.weeklyEyebrow}</p>
            <h2>{t.weeklyTitle}</h2>
          </div>
          <div className="chart-tabs" role="tablist" aria-label={language === "zh" ? "周内图表模式" : "Weekly chart mode"}>
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
          <span>{t.yAxis}</span><span>{t.weeklyAxis}</span>
          <span className="context-spacer" />
          <span>UTC</span>
          <span>{t.chartDenominator}: {result.effectiveWeeks} {t.validUtcWeeks}</span>
        </div>
        <p className="timezone-note">{t.weeklyTimeNote}</p>
        <DistributionChart
          data={distribution}
          mode={mode}
          denominator={result.effectiveWeeks}
          language={language}
          timeZoneLabel="UTC"
          hourly={false}
          period="week"
        />
      </div>

      {ready && result.excludedWeeks.length > 0 && (
        <details className="panel exclusions weekly-exclusions">
          <summary>
            {t.weeklyIntegrityTitle} · {result.excludedWeeks.length} {t.excludedWeekCount}
          </summary>
          <ul>
            {result.excludedWeeks.map((week) => (
              <li key={week.weekStart}>
                <span className="mono">{week.weekStart} → {week.weekEnd}</span>
                <span>{translateWeekReason(week.reason, language)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
