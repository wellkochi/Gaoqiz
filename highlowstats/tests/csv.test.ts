import { describe, expect, it } from "vitest";
import { dailyRecordsToCsv } from "@/src/utils/csv";

describe("CSV 导出", () => {
  it("包含表头、小时区间和完整性", () => {
    const csv = dailyRecordsToCsv([
      {
        date: "2026-07-27",
        high: "120000.00",
        highHour: 6,
        low: "116000.00",
        lowHour: 23,
        complete: true,
        candleCount: 24,
      },
    ]);
    expect(csv.startsWith("\uFEFFUTC 日期")).toBe(true);
    expect(csv).toContain("06:00–07:00");
    expect(csv).toContain("23:00–00:00");
    expect(csv).toContain("完整");
  });

  it("可按英文和本地时区导出", () => {
    const csv = dailyRecordsToCsv(
      [
        {
          date: "2026-07-27",
          high: "120000.00",
          highHour: 6,
          low: "116000.00",
          lowHour: 23,
          complete: true,
          candleCount: 24,
        },
      ],
      { language: "en", timeZone: "Asia/Singapore" },
    );
    expect(csv).toContain("UTC Trading Day");
    expect(csv).toContain("14:00–15:00");
    expect(csv).toContain("07:00–08:00");
    expect(csv).toContain("Complete");
  });
});
