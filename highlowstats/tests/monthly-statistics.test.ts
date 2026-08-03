import { describe, expect, it } from "vitest";
import {
  calculateMonthlyStatistics,
} from "@/src/statistics/calculate";
import type { DailyExtremeRecord } from "@/src/types/market";
import {
  endOfUtcMonth,
  utcDateRange,
  utcMonthsInRange,
  utcWeekOfMonth,
} from "@/src/utils/utc";

function daily(
  date: string,
  high = "200",
  low = "50",
  complete = true,
): DailyExtremeRecord {
  return {
    date,
    high,
    highHour: 6,
    low,
    lowHour: 23,
    complete,
    candleCount: complete ? 24 : 12,
  };
}

describe("UTC 月内极值统计", () => {
  it("按示例把 2026 年 7 月低点计入 1 号、高点计入 21 号和第 4 周", () => {
    const records = utcDateRange("2026-07-01", "2026-07-31").map((date) =>
      daily(
        date,
        date === "2026-07-21" ? "300" : "200",
        date === "2026-07-01" ? "10" : "50",
      ),
    );
    const result = calculateMonthlyStatistics(
      records,
      "2026-07-01",
      "2026-07-31",
    );

    expect(result.effectiveMonths).toBe(1);
    expect(result.records[0]).toMatchObject({
      month: "2026-07",
      lowDate: "2026-07-01",
      lowDay: 1,
      lowWeek: 1,
      highDate: "2026-07-21",
      highDay: 21,
      highWeek: 4,
      dayCount: 31,
    });
    expect(result.dayDistribution[0].lowProbability).toBe(100);
    expect(result.dayDistribution[20].highProbability).toBe(100);
    expect(result.weekDistribution[0].lowProbability).toBe(100);
    expect(result.weekDistribution[3].highProbability).toBe(100);
  });

  it.each([
    ["2026-07-21", 4],
    ["2026-08-01", 1],
    ["2026-08-02", 1],
    ["2026-08-03", 2],
    ["2026-08-31", 6],
    ["2026-06-01", 1],
    ["2026-06-08", 2],
  ])("%s 映射到月内第 %i 周", (date, expectedWeek) => {
    expect(utcWeekOfMonth(date)).toBe(expectedWeek);
  });

  it("固定提供 31 个日期桶和 6 个周次桶，并正确处理不同月长与闰年", () => {
    expect(endOfUtcMonth("2023-02")).toBe("2023-02-28");
    expect(endOfUtcMonth("2024-02")).toBe("2024-02-29");
    expect(endOfUtcMonth("2026-04")).toBe("2026-04-30");
    expect(endOfUtcMonth("2026-07")).toBe("2026-07-31");

    const result = calculateMonthlyStatistics(
      [daily("2024-02-29", "300", "20"), daily("2024-03-31", "250", "10")],
      "2024-02-01",
      "2024-03-31",
    );
    expect(result.dayDistribution).toHaveLength(31);
    expect(result.weekDistribution).toHaveLength(6);
    expect(result.dayDistribution[28].highCount).toBe(1);
    expect(result.dayDistribution[30].lowCount).toBe(1);
  });

  it("跨年范围把不同 YYYY-MM 视为独立样本，并纳入首尾部分月", () => {
    const result = calculateMonthlyStatistics(
      [daily("2025-12-31", "300", "30"), daily("2026-01-01", "250", "10")],
      "2025-12-15",
      "2026-01-10",
    );
    expect(utcMonthsInRange("2025-12-15", "2026-01-10")).toEqual([
      "2025-12",
      "2026-01",
    ]);
    expect(result.selectedCalendarMonths).toBe(2);
    expect(result.effectiveMonths).toBe(2);
    expect(result.records.map((record) => record.month)).toEqual([
      "2025-12",
      "2026-01",
    ]);
  });

  it("允许月份内缺失个别日，但完全没有有效日的月份不会成为零值样本", () => {
    const result = calculateMonthlyStatistics(
      [daily("2026-01-15"), daily("2026-03-12")],
      "2026-01-01",
      "2026-03-31",
    );
    expect(result.selectedCalendarMonths).toBe(3);
    expect(result.effectiveMonths).toBe(2);
    expect(result.excludedMonths).toEqual([
      expect.objectContaining({ month: "2026-02" }),
    ]);
    expect(
      result.dayDistribution.reduce((sum, point) => sum + point.highCount, 0),
    ).toBe(2);
  });

  it("月内价格跨多日重复时选择最早 UTC 日期", () => {
    const result = calculateMonthlyStatistics(
      [daily("2026-07-21", "300", "10"), daily("2026-07-01", "300", "10")],
      "2026-07-01",
      "2026-07-31",
    );
    expect(result.records[0]).toMatchObject({
      highDate: "2026-07-01",
      lowDate: "2026-07-01",
    });
  });

  it("按有效月份数量计算高低点概率分母", () => {
    const result = calculateMonthlyStatistics(
      [
        daily("2026-06-10", "300", "10"),
        daily("2026-07-10", "300", "50"),
        daily("2026-07-20", "250", "10"),
      ],
      "2026-06-01",
      "2026-07-31",
    );
    expect(result.effectiveMonths).toBe(2);
    expect(result.dayDistribution[9].highProbability).toBe(100);
    expect(result.dayDistribution[9].lowProbability).toBe(50);
    expect(result.dayDistribution[19].lowProbability).toBe(50);
  });

  it("设备时区变化不会改变 UTC 月份或周次", () => {
    const originalTimeZone = process.env.TZ;
    try {
      process.env.TZ = "Pacific/Pago_Pago";
      const west = calculateMonthlyStatistics(
        [daily("2026-08-01"), daily("2026-08-31", "300", "10")],
        "2026-08-01",
        "2026-08-31",
      );
      process.env.TZ = "Pacific/Kiritimati";
      const east = calculateMonthlyStatistics(
        [daily("2026-08-01"), daily("2026-08-31", "300", "10")],
        "2026-08-01",
        "2026-08-31",
      );
      expect(east).toEqual(west);
      expect(east.records[0].highWeek).toBe(6);
    } finally {
      process.env.TZ = originalTimeZone;
    }
  });
});
