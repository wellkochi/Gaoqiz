import { describe, expect, it } from "vitest";
import {
  DEVICE_TIME_REFRESH_INTERVAL_MS,
  getDeviceLocalTimeHighlight,
  sessionIndexForHour,
} from "@/src/utils/device-time";

describe("设备本地当前时间高亮", () => {
  it("19:38 本地时间对应 19 时和周一", () => {
    const mondayEvening = new Date(2027, 6, 19, 19, 38);

    const highlight = getDeviceLocalTimeHighlight(mondayEvening);
    expect(highlight.hourIndex).toBe(19);
    expect(highlight.weekdayIndex).toBe(0);
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
