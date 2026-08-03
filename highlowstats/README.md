# highlowstats

`highlowstats` 是一个面向加密货币交易研究的响应式网页 App。它读取 Binance USDⓈ-M Futures 的公开 `1h` K 线，统计：

- 每个完整 UTC 日的最高价、最低价首次出现在哪个小时；
- 每个完整 UTC 周的最高价、最低价首次出现在哪个星期；
- 每个 UTC 自然月的最高价、最低价首次出现于当月几号以及第几周；
- 日内极值在四个 UTC 交易时段的概率分布；
- 与访问设备“今天的具体星期”相同的历史 UTC 日内分布。
- 按访问设备当前本地小时、当前 UTC 交易时段、本地星期、本地月内日期和本地月内周次自动高亮对应图表位置。

项目支持 BTC、ETH、SOL、HYPE、XRP、DOGE、ZEC、BNB，中英文界面，UTC/设备本地时间显示，日期预设、自定义日期范围、进度、取消、IndexedDB 缓存、CSV 导出和桌面/移动响应式布局。

## 技术栈

- UI：React 19、Next.js App Router API、Vinext
- 语言：TypeScript 5，严格模式
- 构建与本地开发：Vite 8、Vinext；GitHub Pages 使用 Next.js Webpack 静态导出
- 样式：Tailwind CSS 4 的 PostCSS 入口 + 项目 CSS
- 图表：Recharts 3
- 高精度价格比较：Decimal.js
- 单元/服务测试：Vitest
- 浏览器交互测试：Playwright
- Sites/Worker 产物：Cloudflare Vite Plugin、Wrangler
- 数据源：Binance USDⓈ-M Futures 公共 K 线 API

## 环境要求

- Node.js `>= 22.13.0`
- npm（项目包含唯一锁文件 `package-lock.json`）
- 普通现代浏览器，需支持 IndexedDB、AbortController 和 `Intl.DateTimeFormat`
- 不依赖构建时下载外部字体；使用系统字体栈，GitHub Actions 和离线构建更稳定

## 安装

```bash
cd highlowstats
npm install
```

## 本地运行

```bash
npm run dev
```

默认访问：

```text
http://localhost:5173
```

Vite 会在端口被占用时选择其他端口，请以终端输出为准。项目不依赖 ChatGPT Sites 登录或专属运行时即可本地启动。

## 验证命令

```bash
npm run typecheck
npm run lint
npm run test
npm run build
npm run build:pages
```

浏览器交互测试首次运行前安装 Chromium：

```bash
PLAYWRIGHT_BROWSERS_PATH=.playwright-browsers npx playwright install chromium
npm run test:e2e
```

构建完成后，本地预览生产产物：

```bash
npm run preview
```

默认访问：

```text
http://localhost:3000
```

## 数据源

八个资产统一使用 Binance USDⓈ-M Futures 公共接口：

```text
GET https://fapi.binance.com/fapi/v1/klines
```

固定参数：

- `symbol`：所选资产的 `USDT` 合约，例如 `BTCUSDT`
- `interval`：`1h`
- `limit`：每页最多 1,000 根
- `startTime` / `endTime`：UTC 毫秒时间戳

公开行情接口不需要 API Key。生产代码不包含 Binance Key、Secret 或认证请求头。调用链：

```text
Dashboard
  → MarketDataClient
    → IndexedDbKlineCache
    → BinanceFuturesProvider
      → Binance Futures public API
```

浏览器直接访问 Binance，避免 Sites 服务端出口地区限制。Binance Provider、缓存和统计函数彼此独立，未来可替换数据源而不改统计口径。

## 数据口径

### 市场与粒度

- 市场：Binance USDⓈ-M Futures
- 合约：BTCUSDT、ETHUSDT、SOLUSDT、HYPEUSDT、XRPUSDT、DOGEUSDT、ZECUSDT、BNBUSDT
- K 线粒度：`1h`
- 价格字段：使用 `high` 与 `low`，不使用 `close` 代替极值

### UTC 日

- UTC 日定义为 `[00:00:00, 次日 00:00:00)`。
- 历史日去重后必须恰好包含同一 UTC 日的 24 个整点小时。
- 数据字段无效、小时缺失或去重后不足 24 根时，整日排除并显示原因。
- 同一最高价或最低价出现在多个小时，按 `openTime` 排序后取首次出现的小时。
- `23:00–00:00` 属于当日第 23 小时，不归入次日。
- 当前未完成 UTC 日默认排除；用户主动纳入时标为动态、非完整记录。

概率分母是有效 UTC 日数：

```text
P(high at hour h) = highCount(h) / validUtcDays × 100%
P(low at hour h)  = lowCount(h)  / validUtcDays × 100%
```

价格以 Binance 字符串进入 Decimal.js 比较，避免用浮点数相等判断重复极值。概率内部保留数值精度，界面显示两位小数。

### UTC 交易时段

- Asia：`00:00–06:00`
- London：`06:00–12:00`
- New York：`12:00–20:00`
- Close：`20:00–00:00`

交易时段始终按 UTC 归类。设备本地时间只影响小时标签，不改变交易日或交易时段样本。

### UTC 周

- UTC 周定义为周一 `00:00` 至下周一 `00:00`。
- 日期范围两端未完整覆盖的周会排除。
- 只有包含周一至周日 7 个有效完整 UTC 日的周才纳入。
- 周最高价/最低价来自 7 个日记录；跨多日重复极值取最早 UTC 日期。
- 周内概率分母是有效完整 UTC 周数。

### UTC 月

- UTC 自然月按 `YYYY-MM` 分组，不同年份的同名月份是不同样本。
- 日期范围首尾未覆盖整月时，使用所选范围内实际有效的 UTC 日；月份内缺失个别无效日不会伪造数据。
- 完全没有有效 UTC 交易日的月份排除，不进入概率分母。
- 月内按天固定显示 `1号` 至 `31号`；不存在的日期保留为 0 值桶。
- 月内按周固定显示 `第1周` 至 `第6周`。月初所在的部分周为第1周，之后每逢 UTC 周一递增。
- 同一月最高价或最低价跨多日重复时，按 UTC 日期排序取最早出现日。

月内周次公式：

```text
weekOfMonth = floor((dateOfMonth + firstDayMondayIndex - 1) / 7) + 1
```

其中 `firstDayMondayIndex` 使用 UTC 星期，周一为 `0`、周日为 `6`。月内概率分母是有效 UTC 月份数。

### Today 开关

它不是把样本合并为“工作日”和“周末”两组，而是读取访问设备今天的具体星期；例如设备今天是周三，开启后仅统计所选范围内的所有周三。它只影响日内小时与交易时段模块，不影响周内、月内统计和每日明细。

### 设备当前时刻高亮

- 24 小时图按设备当前本地小时高亮，例如本地时间 `19:38` 高亮 `19:00–20:00`。
- UTC 交易时段图按当前 UTC 小时匹配四个固定时段，例如 `08:42 UTC` 高亮 `London`。
- 周内星期图按设备当前本地星期高亮。
- 月内按天图按设备当前本地日期高亮；月内按周图按设备本地日历中的当前周次高亮。
- 高亮每 30 分钟更新，并在页面重新获得焦点或恢复可见时立即校准。
- UTC / 本地显示切换不改变高亮依据：小时、星期、月内日期和月内周次读取设备本地钟表，UTC 交易时段读取当前 UTC 小时。

## 缓存

- 历史 K 线按 `symbol + 1h + openTime` 写入 IndexedDB。
- 覆盖范围按交易对隔离，已完成历史区间不会重复请求。
- 当前未完成 UTC 日不写入长期覆盖范围，因此再次统计会重新获取。
- 切换日期范围时只请求未覆盖缺口。
- 本地缓存由浏览器运行时创建，不应提交或打包。

## 项目结构

```text
app/
  layout.tsx                    # HTML 元数据、字体与全局样式入口
  page.tsx                      # 页面路由入口
src/
  components/                  # Dashboard、图表、周/月统计、每日明细
  config/markets.ts            # 资产列表、日期预设和默认范围
  data/
    cache.ts                    # IndexedDB / 测试内存缓存
    providers/binance.ts       # Binance 分页、重试、响应解析
  services/market-data-client.ts
                                # 缓存缺口、分页进度、取消协调
  statistics/
    calculate.ts               # UTC 日/周/月与分布核心纯函数
    display.ts                 # UTC 到设备时区的显示聚合
  types/market.ts              # K 线与统计结果类型
  utils/
    utc.ts                     # UTC 日期、小时、周/月边界与月内周次
    device-time.ts             # 设备本地小时、交易时段、星期和月内位置高亮
    csv.ts                     # 每日明细 CSV
tests/
  *.test.ts                    # 统计、Provider、缓存、时区、CSV
  e2e/dashboard.spec.ts        # 桌面和移动关键交互
worker/index.ts                # Vinext/Cloudflare Worker 入口
.openai/hosting.json           # 现有 ChatGPT Sites 项目标识
AGENTS.md                      # Codex 开发约束和入口说明
```

## 环境变量

当前 App 不需要环境变量。`.env.example` 明确记录这一点。

- 不要创建或提交真实 `.env`、`.env.local` 或任何凭据文件。
- `.openai/hosting.json` 只保存 Sites 项目标识和逻辑绑定，不保存登录 Cookie、Token 或 Secret。
- 若未来添加认证数据源，必须由服务端读取环境变量；不得把 Secret 放入 `NEXT_PUBLIC_*` 或客户端 Bundle。

## ChatGPT Sites 与本地环境

- `.openai/hosting.json` 和 Worker 构建配置用于继续维护现有 Sites 项目。
- 本地 `npm run dev` 使用同一前端源码和数据链路，不依赖 Sites 身份验证。
- 不使用 D1、R2、数据库或 Sites 专属 API。
- 本地构建仍会生成 Worker 兼容产物，便于后续用 Codex 更新原 Site。

## GitHub Pages 与自定义域名

项目可静态导出到 `https://gaoqiz.com/highlowstats/`。本地生成 GitHub Pages 版本：

```bash
npm run build:pages
```

静态文件会输出到 `out/`，所有页面、脚本、样式、字体和 favicon 均使用 `/highlowstats/` 子路径。不要直接提交 `out/`；仓库根目录的 GitHub Actions 工作流负责构建并发布。

ZIP 内的工作流模板位于：

```text
deploy/github-pages.yml
```

把源码文件夹上传为 Gaoqiz 仓库根目录下的 `highlowstats/`，再把模板复制到仓库根目录：

```bash
mkdir -p .github/workflows
cp highlowstats/deploy/github-pages.yml .github/workflows/deploy-pages.yml
```

GitHub Pages 的 Source 必须设为 `GitHub Actions`。工作流监听 Gaoqiz 仓库的 `master` 分支，会保留现有主页和 `CNAME`，并把静态 App 放入发布产物的 `highlowstats/` 目录。

本地预览子路径版本：

```bash
npm run build:pages
mkdir -p /tmp/gaoqiz-preview/highlowstats
cp -R out/. /tmp/gaoqiz-preview/highlowstats/
python3 -m http.server 8080 --directory /tmp/gaoqiz-preview
```

然后访问：

```text
http://localhost:8080/highlowstats/
```

## 测试覆盖

现有测试覆盖：

- 单日最高/最低小时识别；
- 三日 `33.33%` 示例；
- UTC 日期边界与闭区间；
- `23:00–00:00`；
- 重复极值首次出现规则；
- 缺失、重复、非法 K 线；
- 当前未完成 UTC 日；
- 小时与交易时段概率；
- 设备本地时区与非整小时时区；
- Today 具体星期筛选；
- 设备本地小时、交易时段、星期、月内日期和月内周次高亮；
- UTC 周边界、完整周、周内极值与分布；
- UTC 自然月、首尾部分月、跨年、闰年、月内 1–31 日和第 1–6 周分布；
- 月内重复极值、缺失月、有效月份概率分母和跨设备时区一致性；
- Binance 分页、重试、Rate Limit；
- 缓存命中；
- 中英文和 CSV；
- 多资产、折叠明细、Hourly / Weekly / Monthly 独立图表切换的桌面与移动端交互。

生产环境不会使用测试 Mock。Mock 只存在于 Vitest/Playwright 测试代码中。

## 常见问题

### Binance 请求失败

先在同一网络中访问 Binance Futures API。部分国家/地区、公司网络、VPN 或 DNS 会阻断 `fapi.binance.com`。App 不会绕过 Binance 地区政策。

### CORS

当前公共 K 线接口支持项目所需的浏览器请求。若企业代理或安全软件改写响应并移除 CORS Header，浏览器仍会拦截；不要关闭浏览器安全策略，应修复网络代理或在你控制的服务端增加合规代理。

### API Rate Limit

Provider 遇到 `429` 或可重试的服务端错误时会指数退避。频繁切换大日期范围仍可能触发限制；等待后重试，缓存命中后请求量会显著减少。

### 大范围历史数据加载

“全部历史”会分页加载数万根小时 K 线，首次耗时取决于网络。界面会显示进度并支持取消；再次查询优先使用 IndexedDB。

### 当前 UTC 日是否纳入

默认不纳入。启用后仅使用当前已返回的小时 K 线，记录标记为进行中，结果会变化。

### 清除缓存

在浏览器站点数据中删除 IndexedDB 数据库 `binance-futures-intraday-distribution`。下次统计会重新下载。

## 已知限制

- 仅支持上述八个 Binance USDⓈ-M Futures `USDT` 合约和 `1h` 粒度。
- `1h` K 线只能定位到小时，不能定位分钟或秒。
- Futures 合约价格不等于 Spot 现货价格。
- 全部历史首次加载速度和可用性受 Binance、地区网络和 Rate Limit 影响。
- IndexedDB 是设备本地缓存，不在不同浏览器或设备之间同步。
- 本地时间视图遇到夏令时切换日时，显示桶可能出现重复或缺失的本地钟点；底层 UTC 样本与概率口径不变。

## 免责声明

仅供数据研究，不构成投资建议。
