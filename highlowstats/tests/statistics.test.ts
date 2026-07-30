import { describe, expect, it } from "vitest";
import {
  calculateDailyExtremes,
  calculateSessionDistribution,
  calculateStatistics,
  calculateWeeklyStatistics,
  dedupeKlines,
  filterDailyRecordsByUtcWeekday,
  roundPercentage,
  validateUtcDay,
} from "@/src/statistics/calculate";
import { formatUtcHourBucket, utcDateRange } from "@/src/utils/utc";
import { makeDay } from "@/tests/helpers";

describe("BTC 日内极值统计", () => {
  it("识别单日最高点与最低点小时", () => {
    const result = calculateStatistics(
      makeDay("2026-07-27", 6, 23),
      "2026-07-27",
      "2026-07-27",
      { now: Date.parse("2026-07-28T12:00:00Z") },
    );
    expect(result.effectiveDays).toBe(1);
    expect(result.records[0]).toMatchObject({ highHour: 6, lowHour: 23 });
  });

  it("通过三日 33.33% 业务示例", () => {
    const klines = [
      ...makeDay("2026-07-25", 4, 21),
      ...makeDay("2026-07-26", 5, 22),
      ...makeDay("2026-07-27", 6, 23),
    ];
    const result = calculateStatistics(klines, "2026-07-25", "2026-07-27", {
      now: Date.parse("2026-07-28T12:00:00Z"),
    });
    expect(result.effectiveDays).toBe(3);
    for (const hour of [4, 5, 6]) {
      expect(result.distribution[hour].highProbability).toBeCloseTo(100 / 3, 10);
    }
    for (const hour of [21, 22, 23]) {
      expect(result.distribution[hour].lowProbability).toBeCloseTo(100 / 3, 10);
    }
    expect(result.distribution[0].highProbability).toBe(0);
    expect(roundPercentage(result.distribution[4].highProbability)).toBe("33.33");
  });

  it("按固定 UTC 交易时段聚合概率并正确处理边界", () => {
    const records = [
      ...makeDay("2026-07-24", 0, 5),
      ...makeDay("2026-07-25", 6, 11),
      ...makeDay("2026-07-26", 12, 19),
      ...makeDay("2026-07-27", 20, 23),
    ];
    const result = calculateStatistics(records, "2026-07-24", "2026-07-27", {
      now: Date.parse("2026-07-28T00:00:00Z"),
    });
    const sessions = calculateSessionDistribution(result.records);
    expect(sessions.map((point) => point.bucket)).toEqual([
      "Asia", "London", "New York", "Close",
    ]);
    expect(sessions.map((point) => point.highProbability)).toEqual([25, 25, 25, 25]);
    expect(sessions.map((point) => point.lowProbability)).toEqual([25, 25, 25, 25]);
  });

  it("Today 开关按当前具体 UTC 星期筛选日内样本", () => {
    const result = calculateStatistics(
      [
        ...makeDay("2026-07-27", 4, 20),
        ...makeDay("2026-07-28", 5, 21),
        ...makeDay("2026-07-29", 6, 22),
        ...makeDay("2026-07-30", 7, 23),
      ],
      "2026-07-27",
      "2026-07-30",
      { now: Date.parse("2026-07-31T00:00:00Z") },
    );
    const wednesdays = filterDailyRecordsByUtcWeekday(result.records, 2);
    expect(wednesdays).toHaveLength(1);
    expect(wednesdays[0]).toMatchObject({
      date: "2026-07-29",
      highHour: 6,
      lowHour: 22,
    });
    expect(calculateSessionDistribution(wednesdays).map((point) => point.highCount))
      .toEqual([0, 1, 0, 0]);
  });

  it("严格按 UTC 日期边界分组", () => {
    const first = makeDay("2026-07-25", 23, 0);
    const second = makeDay("2026-07-26", 0, 23);
    const result = calculateStatistics(
      [...first, ...second],
      "2026-07-25",
      "2026-07-26",
      { now: Date.parse("2026-07-28T00:00:00Z") },
    );
    expect(result.records.map((row) => [row.date, row.highHour])).toEqual([
      ["2026-07-25", 23],
      ["2026-07-26", 0],
    ]);
  });

  it("正确显示 23:00–00:00", () => {
    expect(formatUtcHourBucket(23)).toBe("23:00–00:00");
  });

  it("同一极值重复出现时选择最早小时，且使用 Decimal 比较", () => {
    const day = makeDay("2026-07-25", 5, 21);
    day[8] = { ...day[8], high: "250.000000000000000000" };
    day[22] = { ...day[22], low: "25.000000000000000000" };
    const { records } = calculateDailyExtremes(day, "2026-07-25", "2026-07-25", {
      now: Date.parse("2026-07-28T00:00:00Z"),
    });
    expect(records[0].highHour).toBe(5);
    expect(records[0].lowHour).toBe(21);
  });

  it("缺少小时 K 线时排除该日", () => {
    const result = calculateStatistics(
      makeDay("2026-07-25").slice(0, 23),
      "2026-07-25",
      "2026-07-25",
      { now: Date.parse("2026-07-28T00:00:00Z") },
    );
    expect(result.effectiveDays).toBe(0);
    expect(result.excludedDays[0].reason).toContain("23/24");
  });

  it("重复 K 线先去重再验证完整性", () => {
    const day = makeDay("2026-07-25");
    const duplicate = { ...day[4] };
    expect(dedupeKlines([...day, duplicate])).toHaveLength(24);
    expect(validateUtcDay([...day, duplicate]).valid).toBe(true);
  });

  it("日期范围包含开始日和结束日", () => {
    expect(utcDateRange("2026-07-25", "2026-07-27")).toEqual([
      "2026-07-25",
      "2026-07-26",
      "2026-07-27",
    ]);
  });

  it("当前未完成 UTC 日默认排除，手动开启后可纳入", () => {
    const now = Date.parse("2026-07-27T10:30:00Z");
    const partial = makeDay("2026-07-27").slice(0, 11);
    const excluded = calculateStatistics(partial, "2026-07-27", "2026-07-27", {
      now,
    });
    expect(excluded.effectiveDays).toBe(0);
    expect(excluded.excludedDays[0].reason).toContain("默认排除");

    const included = calculateStatistics(partial, "2026-07-27", "2026-07-27", {
      now,
      includeCurrentDay: true,
    });
    expect(included.effectiveDays).toBe(1);
    expect(included.records[0].complete).toBe(false);
    expect(included.records[0].candleCount).toBe(11);
  });

  it("使用有效交易日数量作为概率分母并显示两位小数", () => {
    const result = calculateStatistics(
      [
        ...makeDay("2026-07-25", 4, 21),
        ...makeDay("2026-07-26", 4, 22),
        ...makeDay("2026-07-27", 6, 23),
      ],
      "2026-07-25",
      "2026-07-27",
      { now: Date.parse("2026-07-28T00:00:00Z") },
    );
    expect(result.distribution[4].highCount).toBe(2);
    expect(roundPercentage(result.distribution[4].highProbability)).toBe("66.67");
  });

  it("无效价格字段会排除整个交易日", () => {
    const day = makeDay("2026-07-25");
    day[9] = { ...day[9], high: "not-a-price" };
    const result = calculateStatistics(day, "2026-07-25", "2026-07-25", {
      now: Date.parse("2026-07-28T00:00:00Z"),
    });
    expect(result.effectiveDays).toBe(0);
    expect(result.excludedDays[0].reason).toContain("不合法");
  });

  it("按 UTC 周一至周日识别周内最高点和最低点", () => {
    const dailyRecords = [
      ["2026-07-20", "100", "50"],
      ["2026-07-21", "180", "40"],
      ["2026-07-22", "150", "10"],
      ["2026-07-23", "140", "20"],
      ["2026-07-24", "130", "30"],
      ["2026-07-25", "120", "35"],
      ["2026-07-26", "110", "45"],
    ].map(([date, high, low]) => ({
      date,
      high,
      highHour: 6,
      low,
      lowHour: 23,
      complete: true,
      candleCount: 24,
    }));
    const weekly = calculateWeeklyStatistics(
      dailyRecords,
      "2026-07-20",
      "2026-07-26",
    );
    expect(weekly.effectiveWeeks).toBe(1);
    expect(weekly.records[0]).toMatchObject({
      weekStart: "2026-07-20",
      weekEnd: "2026-07-26",
      highDate: "2026-07-21",
      highWeekday: 1,
      lowDate: "2026-07-22",
      lowWeekday: 2,
    });
  });

  it("计算多周星期概率并使用有效完整周作为分母", () => {
    const firstWeek = [
      ["2026-07-20", "100", "50"],
      ["2026-07-21", "200", "40"],
      ["2026-07-22", "150", "10"],
      ["2026-07-23", "140", "20"],
      ["2026-07-24", "130", "30"],
      ["2026-07-25", "120", "35"],
      ["2026-07-26", "110", "45"],
    ];
    const secondWeek = [
      ["2026-07-27", "100", "50"],
      ["2026-07-28", "110", "40"],
      ["2026-07-29", "120", "30"],
      ["2026-07-30", "220", "20"],
      ["2026-07-31", "140", "25"],
      ["2026-08-01", "130", "15"],
      ["2026-08-02", "125", "5"],
    ];
    const dailyRecords = [...firstWeek, ...secondWeek].map(([date, high, low]) => ({
      date,
      high,
      highHour: 8,
      low,
      lowHour: 18,
      complete: true,
      candleCount: 24,
    }));
    const weekly = calculateWeeklyStatistics(
      dailyRecords,
      "2026-07-20",
      "2026-08-02",
    );
    expect(weekly.effectiveWeeks).toBe(2);
    expect(weekly.distribution[1].highProbability).toBe(50);
    expect(weekly.distribution[3].highProbability).toBe(50);
    expect(weekly.distribution[2].lowProbability).toBe(50);
    expect(weekly.distribution[6].lowProbability).toBe(50);
    expect(
      weekly.distribution.reduce((sum, point) => sum + point.highProbability, 0),
    ).toBe(100);
  });

  it("排除日期范围边界处不完整的 UTC 周", () => {
    const records = utcDateRange("2026-07-20", "2026-08-02").map((date) => ({
      date,
      high: "200",
      highHour: 6,
      low: "50",
      lowHour: 23,
      complete: true,
      candleCount: 24,
    }));
    const weekly = calculateWeeklyStatistics(records, "2026-07-21", "2026-08-02");
    expect(weekly.selectedCalendarWeeks).toBe(2);
    expect(weekly.effectiveWeeks).toBe(1);
    expect(weekly.excludedWeeks[0].reason).toContain("未完整覆盖");
  });

  it("周内价格跨多日重复时选择最早的 UTC 日期", () => {
    const records = utcDateRange("2026-07-20", "2026-07-26").map((date) => ({
      date,
      high: "200.000000000000000000",
      highHour: 6,
      low: "50.000000000000000000",
      lowHour: 23,
      complete: true,
      candleCount: 24,
    }));
    const weekly = calculateWeeklyStatistics(records, "2026-07-20", "2026-07-26");
    expect(weekly.records[0].highWeekday).toBe(0);
    expect(weekly.records[0].lowWeekday).toBe(0);
  });
});
