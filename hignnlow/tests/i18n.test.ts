import { describe, expect, it } from "vitest";
import { replaceTokens } from "@/src/i18n";

describe("界面文案插值", () => {
  it("会替换同一文案内重复出现的变量", () => {
    expect(
      replaceTokens("{weekday} / {weekday} / {count}", {
        weekday: "周三",
        count: 4,
      }),
    ).toBe("周三 / 周三 / 4");
  });
});
