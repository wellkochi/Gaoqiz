import { describe, expect, it } from "vitest";
import {
  DEVICE_TIME_REFRESH_INTERVAL_MS,
  getDeviceLocalTimeHighlight,
  localWeekOfMonthIndex,
  sessionIndexForHour,
} from "@/src/utils/device-time";

describe("设备本地当前时间高亮", () => {
  it("19:38 本地时间对应 19 时和周一", () => {
    const mondayEvening = new Date(2027, 6, 19, 19, 38);

    const highlight = getDeviceLocalTimeHighlight(mondayEvening);
    expect(highlight.hourIndex).toBe(19);
    expect(highlight.weekdayIndex).toBe(0);
    expect(highlight.dayOfMonthIndex).toBe(18);
    expect(highlight.weekOfMonthIndex).toBe(3);
  });

  it.each([
    [new Date(2026, 7, 1, 12), 0],
    [new Date(2026, 7, 2, 12), 0],
    [new Date(2026, 7, 3, 12), 1],
    [new Date(2026, 7, 31, 12), 5],
  ])("设备本地日期 %s 映射到月内周索引 %i", (date, weekIndex) => {
    expect(localWeekOfMonthIndex(date)).toBe(weekIndex);
  });

  it("拒绝无效本地日期", () => {
    expect(() => localWeekOfMonthIndex(new Date(Number.NaN))).toThrow();
  });

  it("交易时段使用 UTC 小时，不误用设备本地小时", () => {
    const londonMorning = new Date("2026-07-30T08:42:00.000Z");

    expect(getDeviceLocalTimeHighlight(londonMorning).sessionIndex).toBe(1);
  });

  it("每 30 分钟自动校准一次", () => {
    expect(DEVICE_TIME_REFRESH_INTERVAL_MS).toBe(1_800_000);
  });

  it.each([
    [0, 0],
    [5, 0],
    [6, 1],
    [11, 1],
    [12, 2],
    [19, 2],
    [20, 3],
    [23, 3],
  ])("%i 时映射到交易时段 %i", (hour, session) => {
    expect(sessionIndexForHour(hour)).toBe(session);
  });

  it("拒绝非法小时", () => {
    expect(() => sessionIndexForHour(-1)).toThrow();
    expect(() => sessionIndexForHour(24)).toThrow();
  });
});
