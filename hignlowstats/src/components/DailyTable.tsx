"use client";

import { useMemo, useState } from "react";
import type { Language } from "@/src/i18n";
import { formatZonedHourBucket } from "@/src/statistics/display";
import type { DailyExtremeRecord } from "@/src/types/market";
import { dailyRecordsToCsv } from "@/src/utils/csv";

type SortKey = "date" | "highHour" | "lowHour";
type SortDirection = "asc" | "desc";

export function DailyTable({
  records,
  symbol,
  language,
  timeZone,
  timeZoneLabel,
}: {
  records: DailyExtremeRecord[];
  symbol: string;
  language: Language;
  timeZone: string;
  timeZoneLabel: string;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [direction, setDirection] = useState<SortDirection>("desc");
  const [expanded, setExpanded] = useState(false);

  const sorted = useMemo(
    () =>
      [...records].sort((a, b) => {
        const comparison =
          sortKey === "date"
            ? a.date.localeCompare(b.date)
            : a[sortKey] - b[sortKey];
        return direction === "asc" ? comparison : -comparison;
      }),
    [records, sortKey, direction],
  );

  function sortBy(key: SortKey) {
    if (key === sortKey) {
      setDirection((value) => (value === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setDirection("asc");
    }
  }

  function exportCsv() {
    const blob = new Blob([dailyRecordsToCsv(sorted, { language, timeZone })], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${symbol}-daily-extremes-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const sortMark = (key: SortKey) =>
    key === sortKey ? (direction === "asc" ? " ↑" : " ↓") : "";
  const labels =
    language === "zh"
      ? {
          eyebrow: "DAILY RECORDS",
          title: "每日统计明细",
          export: "导出 CSV",
          expand: "展开明细",
          collapse: "折叠明细",
          date: "UTC 交易日",
          highPrice: "当日最高价",
          highHour: "最高点小时",
          lowPrice: "当日最低价",
          lowHour: "最低点小时",
          integrity: "完整性",
          complete: "✓ 完整",
          live: "● 进行中",
          empty: "暂无有效交易日数据",
          total: "个有效 UTC 交易日",
          unit: "价格单位 USDT",
          display: "显示时区",
          candles: "根",
        }
      : {
          eyebrow: "DAILY RECORDS",
          title: "Daily records",
          export: "Export CSV",
          expand: "Expand records",
          collapse: "Collapse records",
          date: "UTC trading day",
          highPrice: "Daily high",
          highHour: "High time",
          lowPrice: "Daily low",
          lowHour: "Low time",
          integrity: "Integrity",
          complete: "✓ Complete",
          live: "● Live",
          empty: "No valid trading-day data",
          total: "valid UTC trading days",
          unit: "Prices in USDT",
          display: "Display time",
          candles: "candles",
        };

  return (
    <section className="panel detail-panel" aria-labelledby="daily-table-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{labels.eyebrow}</p>
          <h2 id="daily-table-title">{labels.title}</h2>
        </div>
        <div className="detail-actions">
          <button
            className="secondary-button collapse-button"
            type="button"
            aria-expanded={expanded}
            aria-controls="daily-table-content"
            onClick={() => setExpanded((value) => !value)}
          >
            <span className="collapse-chevron" aria-hidden="true">
              {expanded ? "⌃" : "⌄"}
            </span>
            {expanded ? labels.collapse : labels.expand}
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={exportCsv}
            disabled={!records.length}
          >
            <span aria-hidden="true">⇩</span> {labels.export}
          </button>
        </div>
      </div>
      {expanded && (
        <div id="daily-table-content">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>
                    <button onClick={() => sortBy("date")}>{labels.date}{sortMark("date")}</button>
                  </th>
                  <th className="number">{labels.highPrice}</th>
                  <th>
                    <button onClick={() => sortBy("highHour")}>
                      ▲ {labels.highHour}{sortMark("highHour")}
                    </button>
                  </th>
                  <th className="number">{labels.lowPrice}</th>
                  <th>
                    <button onClick={() => sortBy("lowHour")}>
                      ▼ {labels.lowHour}{sortMark("lowHour")}
                    </button>
                  </th>
                  <th>{labels.integrity}</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((record) => (
                  <tr key={record.date}>
                    <td className="mono">{record.date}</td>
                    <td className="number mono">${Number(record.high).toLocaleString(language === "zh" ? "zh-CN" : "en-US")}</td>
                    <td>
                      <span className="hour-tag high-tag">
                        {formatZonedHourBucket(record.date, record.highHour, timeZone)}
                      </span>
                    </td>
                    <td className="number mono">${Number(record.low).toLocaleString(language === "zh" ? "zh-CN" : "en-US")}</td>
                    <td>
                      <span className="hour-tag low-tag">
                        {formatZonedHourBucket(record.date, record.lowHour, timeZone)}
                      </span>
                    </td>
                    <td>
                      <span className={record.complete ? "status complete" : "status live"}>
                        {record.complete
                          ? labels.complete
                          : `${labels.live} · ${record.candleCount} ${labels.candles}`}
                      </span>
                    </td>
                  </tr>
                ))}
                {!sorted.length && (
                  <tr>
                    <td colSpan={6} className="empty-cell">{labels.empty}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="table-note">
            {language === "zh" ? "共 " : ""}
            {records.length.toLocaleString(language === "zh" ? "zh-CN" : "en-US")} {labels.total}
            {" · "}{labels.unit} · {labels.display}: {timeZoneLabel}
          </p>
        </div>
      )}
    </section>
  );
}
