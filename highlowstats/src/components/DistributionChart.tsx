"use client";

import {
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
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

interface TickPayload {
  value: string;
}

function DistributionTick({
  x = 0,
  y = 0,
  payload,
  highlightedBuckets,
  hourly,
}: {
  x?: number;
  y?: number;
  payload?: TickPayload;
  highlightedBuckets: Set<string>;
  hourly: boolean;
}) {
  if (!payload) return null;
  const highlighted = highlightedBuckets.has(payload.value);
  const label = hourly ? payload.value.slice(0, 5) : payload.value;

  return (
    <g
      className={highlighted ? "chart-tick current-time-tick" : "chart-tick"}
      data-current-time={highlighted ? "true" : undefined}
      transform={`translate(${x},${y})`}
    >
      {highlighted && (
        <circle
          className="current-time-tick-marker"
          cx={-5}
          cy={11}
          r={4}
        />
      )}
      <text
        x={0}
        y={0}
        dy={16}
        textAnchor="end"
        transform="rotate(-45)"
      >
        {label}
      </text>
    </g>
  );
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
  highlightedIndexes = [],
}: {
  data: DistributionPoint[];
  mode: Mode;
  denominator: number;
  language: Language;
  timeZoneLabel: string;
  hourly?: boolean;
  period?: "day" | "week";
  highlightedIndexes?: number[];
}) {
  const yFormatter = (value: number) => `${value}%`;
  const highlightedIndexSet = new Set(highlightedIndexes);
  const highlightedBuckets = new Set(
    data
      .filter((point) => highlightedIndexSet.has(point.index))
      .map((point) => point.bucket),
  );
  const currentTimeLabel =
    language === "zh" ? "设备当前本地时间" : "Current device local time";
  const chartAriaLabel =
    language === "zh" ? "极值概率分布图" : "Extreme probability chart";
  const highlightedAria = highlightedBuckets.size
    ? `${chartAriaLabel} · ${currentTimeLabel}: ${[...highlightedBuckets].join(", ")}`
    : chartAriaLabel;
  const tick = (props: {
    x?: number;
    y?: number;
    payload?: TickPayload;
  }) => (
    <DistributionTick
      {...props}
      highlightedBuckets={highlightedBuckets}
      hourly={hourly}
    />
  );
  const referenceLines = [...highlightedBuckets].map((bucket) => (
    <ReferenceLine
      key={bucket}
      className="current-time-reference"
      x={bucket}
      stroke="#d68a16"
      strokeDasharray="4 4"
      strokeWidth={2}
    />
  ));

  return (
    <div
      className="chart-scroll"
      role="region"
      aria-label={highlightedAria}
      tabIndex={0}
    >
      <div className={hourly ? "chart-inner" : "chart-inner compact-chart"}>
        <ResponsiveContainer width="100%" height={360}>
          {mode === "combined" ? (
            <LineChart data={data} margin={{ top: 18, right: 20, left: 4, bottom: 16 }}>
              <CartesianGrid strokeDasharray="3 5" vertical={false} stroke="#e3e7ec" />
              <XAxis
                dataKey="bucket"
                interval={0}
                height={62}
                tick={tick}
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
              {referenceLines}
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
                interval={0}
                height={62}
                tick={tick}
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
              >
                {data.map((point) => {
                  const highlighted = highlightedIndexSet.has(point.index);
                  return (
                    <Cell
                      key={point.bucket}
                      className={highlighted ? "current-time-bar" : undefined}
                      data-current-time={highlighted ? "true" : undefined}
                      fill={
                        mode === "high"
                          ? highlighted ? "#2f6fe4" : "#1457d9"
                          : highlighted ? "#e76852" : "#d9553f"
                      }
                      stroke={highlighted ? "#d68a16" : "none"}
                      strokeWidth={highlighted ? 3 : 0}
                    />
                  );
                })}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
