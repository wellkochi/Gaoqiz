# AGENTS.md

## 项目用途

`highlowstats` 使用 Binance USDⓈ-M Futures 公共 `1h` K 线，研究八个加密资产的日内高低点小时/UTC 交易时段分布，以及完整 UTC 周内高低点的星期分布。

不要把它改成实时交易、下单或投资建议产品。修改应保持当前统计口径和 UI 行为，除非用户明确要求改变。

## 技术栈与入口

- React 19 + TypeScript + Next.js App Router API
- Vinext + Vite 负责本地开发和 Worker 兼容构建
- Recharts 图表、Decimal.js 价格比较
- Vitest 单元/服务测试、Playwright 浏览器测试
- 页面入口：`app/page.tsx`
- 主界面：`src/components/Dashboard.tsx`
- 全局样式：`app/globals.css`
- Worker 入口：`worker/index.ts`
- Sites 身份：`.openai/hosting.json`
- GitHub Pages 配置：`next.config.ts`
- GitHub Pages 构建入口：`scripts/build-pages.mjs`
- GitHub Pages 工作流模板：`deploy/github-pages.yml`

## 主要目录

- `src/components/`：UI、图表、周统计、每日明细
- `src/config/markets.ts`：交易资产、快速日期范围和默认 30 日
- `src/data/providers/binance.ts`：Binance Futures 请求、分页、重试、响应校验
- `src/data/cache.ts`：IndexedDB 缓存和测试用 Memory Cache
- `src/services/market-data-client.ts`：缓存缺口、分页进度和取消信号
- `src/statistics/calculate.ts`：日/周极值、小时/时段/星期概率纯函数
- `src/statistics/display.ts`：UTC 小时转换为设备时区显示桶
- `src/utils/utc.ts`：UTC 日期、小时、周边界
- `src/utils/csv.ts`：每日明细 CSV
- `src/types/market.ts`：数据与统计类型
- `tests/`：统计、Provider、缓存、时区、CSV 和浏览器交互

## 本地命令

```bash
npm install
npm run dev
npm run typecheck
npm run lint
npm run test
npm run build
npm run build:pages
npm run preview
```

默认开发地址是 `http://localhost:5173`；生产预览默认是 `http://localhost:3000`。Playwright 使用：

```bash
PLAYWRIGHT_BROWSERS_PATH=.playwright-browsers npx playwright install chromium
npm run test:e2e
```

## 必须保持的业务规则

1. 市场固定为 Binance USDⓈ-M Futures；当前八个 symbol 在 `src/config/markets.ts`。
2. K 线固定 `1h`，极值使用 `high` / `low`，不得使用 `close` 代替。
3. UTC 日固定为 `[00:00, 次日 00:00)`；不得用浏览器本地日期分组。
4. 历史日去重后必须包含同一 UTC 日 24 个整点小时，否则整日排除并显示原因。
5. 日期范围是闭区间，开始日和结束日均纳入。
6. 同一日重复最高/最低价取最早 UTC 小时；使用 Decimal.js 比较字符串价格。
7. 当前 UTC 日默认排除；主动纳入时标为进行中，不写入长期完整历史覆盖。
8. 小时/交易时段概率分母是当前日内筛选后的有效日数，不是 K 线数。
9. UTC 交易时段边界固定：Asia 0–6、London 6–12、New York 12–20、Close 20–24。
10. `weekday/weekend` 开关按访问设备今天的“具体星期”筛选历史 UTC 日，只影响日内模块。
11. UTC 周固定周一到周日；必须有 7 个完整有效日。跨日重复极值取最早日期。
12. 周内概率分母是有效完整周数；日内 weekday 筛选不得影响周内统计。
13. UTC/本地切换只改变显示，不改变 UTC 日、周和交易时段样本。
14. 生产环境只能读取真实 Binance 数据；Mock 仅允许在 `tests/`。
15. GitHub Pages 的公开路径固定为 `/highnlow/`；修改页面资源时必须同时验证子路径，不得假设部署在域名根目录。

## 数据层注意事项

- Binance 单页上限为 1,000 根，分页游标必须严格前进，避免重复页或死循环。
- 已完成历史覆盖才可以写入缓存 coverage；当前 UTC 日每次重新获取。
- 缓存键必须继续包含 symbol 与 `1h`，不同市场不得串数据。
- 请求需保留 AbortSignal、重试、指数退避和 Rate Limit 区分。
- 新增资产前先确认对应 Binance Futures symbol 和最早可用时间。

## 测试要求

修改统计、UTC、Provider、缓存、CSV 或资产配置时，先补/改相应测试。至少运行：

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

修改交互、布局、语言或图表时，再运行 `npm run test:e2e` 并检查桌面和移动端。

不要通过关闭 TypeScript strict、禁用关键 ESLint 规则或大量添加 ignore 注释来“修复”检查。

## Secret 与文件卫生

- 公共 Binance K 线接口不需要 API Key。
- 禁止提交 `.env`、`.env.local`、Cookie、Authorization Header、Token、API Secret、私钥、Seed Phrase 或个人账号信息。
- 若未来必须增加 Secret，只能由服务端环境变量读取；客户端可见的 `NEXT_PUBLIC_*` 绝不能保存 Secret。
- `.env.example` 只能放变量名和明显安全的示例值。
- 不要提交 `node_modules/`、`dist/`、`.vinext/`、`.wrangler/`、测试报告、缓存、日志或历史行情缓存。
- `.openai/hosting.json` 必须保留，以便 Codex 识别并继续维护原 Sites 项目；不要手工修改其 `project_id`。

## 常见开发陷阱

- `23:00–00:00` 仍属于 K 线开盘日。
- 设备本地时区可能有半小时偏移或夏令时，显示分布必须按每条记录的真实日期转换。
- 同价判断不能用 JavaScript 浮点数直接相等。
- 交易时段固定 UTC，不随显示时区切换。
- 日内 weekday 筛选使用设备今天的星期；周统计始终使用全部有效日记录。
- `DailyTable` 默认折叠，但 CSV 导出无需先展开。
- 不要删除 Sites/Vinext 构建脚本；本地开发不依赖 Sites，但后续更新原部署需要这些文件。
- `npm run build` 是 Sites/Worker 构建；`npm run build:pages` 是 GitHub Pages 静态导出。不要把两种产物或部署流程混用。
- GitHub 只识别仓库根目录的 `.github/workflows/`。项目内 `deploy/github-pages.yml` 是模板，放入 `Gaoqiz/highlowstats/` 后需复制到 `Gaoqiz/.github/workflows/deploy-pages.yml`。
