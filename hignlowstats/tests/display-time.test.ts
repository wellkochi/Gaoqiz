import { describe, expect, it } from "vitest";
import {
  calculateDisplayDistribution,
  formatZonedHourBucket,
} from "@/src/statistics/display";
import type { DailyExtremeRecord } from "@/src/types/market";

const record: DailyExtremeRecord = {
  date: "2026-07-27",
  high: "120000",
  highHour: 6,
  low: "116000",
  lowHour: 23,
  complete: true,
  candleCount: 24,
};

describe("显示时区", () => {
  it("按设备时区重新聚合小时，同时保留 UTC 交易日记录", () => {
    const distribution = calculateDisplayDistribution(
      [record],
      "Asia/Singapore",
      record.date,
    );
    expect(distribution.find((point) => point.bucket === "14:00–15:00")).toMatchObject({
      highCount: 1,
      highProbability: 100,
    });
    expect(distribution.find((point) => point.bucket === "07:00–08:00")).toMatchObject({
      lowCount: 1,
      lowProbability: 100,
    });
    expect(record.date).toBe("2026-07-27");
  });

  it("支持非整小时时区", () => {
    expect(formatZonedHourBucket(record.date, 6, "Asia/Kolkata")).toBe(
      "11:30–12:30",
    );
  });

  it("UTC 模式保持原始 24 小时分布", () => {
    const distribution = calculateDisplayDistribution([record], "UTC", record.date);
    expect(distribution).toHaveLength(24);
    expect(distribution[6]).toMatchObject({ bucket: "06:00–07:00", highCount: 1 });
    expect(distribution[23]).toMatchObject({ bucket: "23:00–00:00", lowCount: 1 });
  });
});
