export interface DeviceTimeHighlight {
  hourIndex: number;
  sessionIndex: number;
  weekdayIndex: number;
  dayOfMonthIndex: number;
  weekOfMonthIndex: number;
}

export const DEVICE_TIME_REFRESH_INTERVAL_MS = 30 * 60 * 1000;

export function sessionIndexForHour(hour: number): number {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new Error("小时索引必须在 0 到 23 之间");
  }
  if (hour < 6) return 0;
  if (hour < 12) return 1;
  if (hour < 20) return 2;
  return 3;
}

export function localWeekOfMonthIndex(date: Date): number {
  if (!Number.isFinite(date.getTime())) {
    throw new Error("日期必须有效");
  }
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  const firstDayMondayIndex = (firstDay.getDay() + 6) % 7;
  return Math.floor((date.getDate() + firstDayMondayIndex - 1) / 7);
}

export function getDeviceLocalTimeHighlight(
  date: Date,
): DeviceTimeHighlight {
  const hourIndex = date.getHours();
  return {
    hourIndex,
    sessionIndex: sessionIndexForHour(date.getUTCHours()),
    weekdayIndex: (date.getDay() + 6) % 7,
    dayOfMonthIndex: date.getDate() - 1,
    weekOfMonthIndex: localWeekOfMonthIndex(date),
  };
}
