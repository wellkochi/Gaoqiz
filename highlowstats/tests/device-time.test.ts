import { describe, expect, it } from "vitest";
import {
  getDeviceLocalTimeHighlight,
  sessionIndexForHour,
} from "@/src/utils/device-time";

describe("设备本地当前时间高亮", () => {
  it("19:38 本地时间对应 19 时、New York 时段和周一", () => {
    const mondayEvening = new Date(2027, 6, 19, 19, 38);

    expect(getDeviceLocalTimeHighlight(mondayEvening)).toEqual({
      hourIndex: 19,
      sessionIndex: 2,
      weekdayIndex: 0,
    });
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
