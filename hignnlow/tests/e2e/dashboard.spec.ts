import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("https://fapi.binance.com/fapi/v1/klines?*", async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("startTime") === "0") {
      const time = Date.parse("2017-08-17T00:00:00Z");
      await route.fulfill({
        json: [[time, "100", "150", "75", "110", "1", time + 3_599_999]],
      });
      return;
    }
    const start = Number(url.searchParams.get("startTime"));
    const end = Number(url.searchParams.get("endTime"));
    const klines = [];
    for (let time = start; time <= end; time += 3_600_000) {
      const hour = new Date(time).getUTCHours();
      klines.push([
        time,
        "100",
        hour === 6 ? "200" : "150",
        hour === 23 ? "50" : "75",
        "110",
        "1",
        time + 3_599_999,
      ]);
    }
    await route.fulfill({ json: klines });
  });
});

test("默认加载 30 日并切换对比视图", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".summary-grid").first().locator(".success-card strong")).toHaveText("30");
  await expect(page.getByRole("button", { name: "导出 CSV" })).toBeEnabled();
  const intradayPanel = page.locator(
    'section[aria-labelledby="distribution-title"]',
  );
  await intradayPanel.getByRole("button", { name: "对比视图" }).click();
  await expect(
    intradayPanel.getByRole("button", { name: "对比视图" }),
  ).toHaveClass(/active/);
  await intradayPanel.getByRole("button", { name: "按交易时段" }).click();
  await expect(page.getByRole("heading", { name: "UTC 交易时段极值概率分布" })).toBeVisible();
  await expect(page.locator(".chart-context").first()).toContainText("Asia 00–06");
  const weekdayFilter = page.getByRole("button", {
    name: "只统计与今天相同的星期",
  });
  await expect(weekdayFilter).toHaveAttribute("aria-pressed", "false");
  await weekdayFilter.click();
  await expect(weekdayFilter).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".weekday-filter-note")).toContainText("筛选已开启");
  await expect(page.locator(".chart-context").first()).toContainText("匹配 UTC 日");
  await weekdayFilter.click();
  await expect(weekdayFilter).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator(".chart-context").first()).toContainText("30 个有效 UTC 日");
  await expect(page.locator("#daily-table-content")).toHaveCount(0);
  await page.getByRole("button", { name: "展开明细" }).click();
  await expect(page.locator("tbody tr")).toHaveCount(30);
  await page.getByRole("button", { name: "折叠明细" }).click();
  await expect(page.locator("#daily-table-content")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "周内高低点星期分布" }).first()).toBeVisible();
  await expect(page.locator(".weekly-summary-grid .success-card strong")).toHaveText("4");
});

test("无效日期范围显示中文错误", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".summary-grid").first().locator(".success-card strong")).toHaveText("30");
  await page.getByLabel("开始日期（UTC）").fill("2026-07-28");
  await page.getByLabel("结束日期（UTC）").fill("2026-07-20");
  await page.getByRole("button", { name: "开始统计" }).click();
  await expect(page.getByRole("alert")).toContainText("开始日期不能晚于结束日期");
});

test("切换 ETH、英文和设备本地时区", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".summary-grid").first().locator(".success-card strong")).toHaveText("30");

  const ethRequest = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return (
      url.origin === "https://fapi.binance.com" &&
      url.searchParams.get("symbol") === "ETHUSDT"
    );
  });
  await page.getByRole("button", { name: /ETH ETHUSDT/ }).click();
  await ethRequest;
  await expect(page.locator(".summary-grid").first().locator(".success-card strong")).toHaveText("30");
  await expect(page.locator(".market-meta")).toContainText("ETHUSDT");

  await page.getByRole("button", { name: "EN" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("When does ETH");
  await page.getByRole("button", { name: "Local" }).click();
  await expect(page.locator(".market-meta")).toContainText("Asia/Singapore");
  await expect(
    page
      .locator('section[aria-labelledby="distribution-title"]')
      .locator(".timezone-note"),
  ).toContainText(
    "Trading-day boundaries stay in UTC",
  );
});

test("新增 XRP、DOGE、ZEC 和 BNB 交易资产", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".summary-grid").first().locator(".success-card strong")).toHaveText("30");

  for (const asset of ["XRP", "DOGE", "ZEC", "BNB"]) {
    await expect(
      page.getByRole("button", { name: new RegExp(`${asset} ${asset}USDT`) }),
    ).toBeVisible();
  }

  const zecRequest = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return (
      url.origin === "https://fapi.binance.com" &&
      url.searchParams.get("symbol") === "ZECUSDT"
    );
  });
  await page.getByRole("button", { name: /ZEC ZECUSDT/ }).click();
  await zecRequest;
  await expect(page.locator(".summary-grid").first().locator(".success-card strong")).toHaveText("30");
  await expect(page.locator(".market-meta")).toContainText("ZECUSDT");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("ZEC 高低点");
});
