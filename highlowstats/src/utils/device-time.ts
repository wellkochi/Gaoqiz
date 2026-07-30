export interface DeviceTimeHighlight {
  hourIndex: number;
  sessionIndex: number;
  weekdayIndex: number;
}

export function sessionIndexForHour(hour: number): number {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new Error("小时索引必须在 0 到 23 之间");
  }
  if (hour < 6) return 0;
  if (hour < 12) return 1;
  if (hour < 20) return 2;
  return 3;
}

export function getDeviceLocalTimeHighlight(
  date: Date,
): DeviceTimeHighlight {
  const hourIndex = date.getHours();
  return {
    hourIndex,
    sessionIndex: sessionIndexForHour(hourIndex),
    weekdayIndex: (date.getDay() + 6) % 7,
  };
}
