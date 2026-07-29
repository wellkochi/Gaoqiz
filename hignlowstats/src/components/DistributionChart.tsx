"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Language } from "@/src/i18n";
import type { DistributionPoint } from "@/src/types/market";

type Mode = "high" | "low" | "combined";

interface TooltipPayloadItem {
  dataKey?: string;
  value?: number;
  payload?: DistributionPoint;
}

function ChartTooltip({
  active,
  payload,
  mode,
  denominator,
  language,
  timeZoneLabel,
  period,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  mode: Mode;
  denominator: number;
  language: Language;
  timeZoneLabel: string;
  period: "day" | "week";
}) {
  if (!active || !payload?.[0]?.payload) return null;
  const point = payload[0].payload;
  const high = language === "zh" ? "最高点" : "High";
  const low = language === "zh" ? "最低点" : "Low";
  const periods =
    period === "week"
      ? language === "zh" ? "周" : "weeks"
      : language === "zh" ? "日" : "days";
  return (
    <div className="chart-tooltip">
      <strong>{point.bucket} · {timeZoneLabel}</strong>
      {(mode === "high" || mode === "combined") && (
        <p>
          <span className="tooltip-key high-key" />{high}: {point.highCount} /{" "}
          {denominator} {periods} · {point.highProbability.toFixed(2)}%
        </p>
      )}
      {(mode === "low" || mode === "combined") && (
        <p>
          <span className="tooltip-key low-key" />{low}: {point.lowCount} /{" "}
          {denominator} {periods} · {point.lowProbability.toFixed(2)}%
        </p>
      )}
    </div>
  );
}

export function DistributionChart({
  data,
  mode,
  denominator,
  language,
  timeZoneLabel,
  hourly = true,
  period = "day",
}: {
  data: DistributionPoint[];
  mode: Mode;
  denominator: number;
  language: Language;
  timeZoneLabel: string;
  hourly?: boolean;
  period?: "day" | "week";
}) {
  const tickFormatter = (value: string) => hourly ? value.slice(0, 5) : value;
  const yFormatter = (value: number) => `${value}%`;

  return (
    <div
      className="chart-scroll"
      role="region"
      aria-label={language === "zh" ? "极值概率分布图" : "Extreme probability chart"}
      tabIndex={0}
    >
      <div className={hourly ? "chart-inner" : "chart-inner compact-chart"}>
        <ResponsiveContainer width="100%" height={360}>
          {mode === "combined" ? (
            <LineChart data={data} margin={{ top: 18, right: 20, left: 4, bottom: 16 }}>
              <CartesianGrid strokeDasharray="3 5" vertical={false} stroke="#e3e7ec" />
              <XAxis
                dataKey="bucket"
                tickFormatter={tickFormatter}
                interval={hourly ? 1 : 0}
                angle={-45}
                textAnchor="end"
                height={62}
                tick={{ fill: "#657081", fontSize: 11 }}
              />
              <YAxis
                tickFormatter={yFormatter}
                tick={{ fill: "#657081", fontSize: 12 }}
                width={50}
              />
              <Tooltip
                content={
                  <ChartTooltip
                    mode={mode}
                    denominator={denominator}
                    language={language}
                    timeZoneLabel={timeZoneLabel}
                    period={period}
                  />
                }
              />
              <Legend verticalAlign="top" height={36} />
              <Line
                name={
                  period === "week"
                    ? language === "zh" ? "▲ 周内最高点" : "▲ Weekly high"
                    : language === "zh" ? "▲ 日内最高点" : "▲ Daily high"
                }
                type="monotone"
                dataKey="highProbability"
                stroke="#1457d9"
                strokeWidth={3}
                dot={{ r: 3, fill: "#1457d9" }}
                activeDot={{ r: 6 }}
              />
              <Line
                name={
                  period === "week"
                    ? language === "zh" ? "▼ 周内最低点" : "▼ Weekly low"
                    : language === "zh" ? "▼ 日内最低点" : "▼ Daily low"
                }
                type="monotone"
                dataKey="lowProbability"
                stroke="#d9553f"
                strokeWidth={3}
                strokeDasharray="7 5"
                dot={{ r: 3, fill: "#fff", stroke: "#d9553f", strokeWidth: 2 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          ) : (
            <BarChart data={data} margin={{ top: 18, right: 20, left: 4, bottom: 16 }}>
              <CartesianGrid strokeDasharray="3 5" vertical={false} stroke="#e3e7ec" />
              <XAxis
                dataKey="bucket"
                tickFormatter={tickFormatter}
                interval={hourly ? 1 : 0}
                angle={-45}
                textAnchor="end"
                height={62}
                tick={{ fill: "#657081", fontSize: 11 }}
              />
              <YAxis
                tickFormatter={yFormatter}
                tick={{ fill: "#657081", fontSize: 12 }}
                width={50}
              />
              <Tooltip
                content={
                  <ChartTooltip
                    mode={mode}
                    denominator={denominator}
                    language={language}
                    timeZoneLabel={timeZoneLabel}
                    period={period}
                  />
                }
              />
              <Bar
                name={
                  mode === "high"
                    ? period === "week"
                      ? language === "zh" ? "▲ 周内最高点" : "▲ Weekly high"
                      : language === "zh" ? "▲ 日内最高点" : "▲ Daily high"
                    : period === "week"
                      ? language === "zh" ? "▼ 周内最低点" : "▼ Weekly low"
                      : language === "zh" ? "▼ 日内最低点" : "▼ Daily low"
                }
                dataKey={mode === "high" ? "highProbability" : "lowProbability"}
                fill={mode === "high" ? "#1457d9" : "#d9553f"}
                radius={mode === "high" ? [5, 5, 0, 0] : [0, 0, 5, 5]}
                minPointSize={2}
              />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
