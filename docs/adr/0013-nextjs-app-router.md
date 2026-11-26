# 全栈用 Next.js App Router，领域逻辑留在框架之外

**状态**：已采纳（2026-11-26，「进销存 v1 实现规格」）

单公司自用、22 个路由、单云服务器、1–3 人使用；打印精度是验收项；测试只有 HTTP 一个接缝。决定用 Next.js App Router 一个应用承载页面与 HTTP API，九个领域模块写成不依赖框架的纯 TypeScript 包。

## 决定

- **一个部署单元**：Next.js 承载页面与 Route Handlers，PostgreSQL 单库；不拆独立 API 进程。
- **领域逻辑在九个纯 TS 包里**（主数据 / 单据核心 / 库存账 / 往来账 / 资金账 / 报表 / 打印 / 权限与配置 / 期初与导入）：不 import `next/*`、不依赖 React；账本表只由所属模块写。
- **写操作只走 `/api/*` Route Handlers（JSON）**，UI 客户端用 fetch 调用；Server Actions 不承担写操作。
- 页面读取可以在 server component 里直接调领域查询函数，与 API 复用同一套函数，不复制查询。
- **打印路由服务端直出 HTML**，不依赖客户端 JS；浏览器打印与服务端 Chromium 归档补打共用同一个 URL 与同一份 CSS。
- 全站默认动态渲染（报表一律实时查），不做静态缓存。
- 测试接缝不变：HTTP API 为主；Playwright 只用于界面验收（一屏开单、权限菜单、手机只读）。
- ORM 与迁移工具在实施首票定（Prisma 或 Drizzle），不影响本决定；金额 `numeric`、日期 `date`、时区固定 Asia/Shanghai。

## 考虑过的方案

- **NestJS + React SPA**：Controller 天然是 API 接缝，DI 与模块边界硬；代价是两套构建、跨端会话与鉴权串联、打印要等 hydration，且 controller / service / repository 的分层与规格 §12.1「按九块组织，不按技术分层」相抵。
- **Next.js 用 Server Actions 承担写**：代码更短，但写操作不再是明面的 HTTP 端点，测试与 AFK 实施失去唯一接缝。
- **Remix / React Router 7**：action / loader 天然是 HTTP，打印也直出；但团队与 agent 的既有经验集中在 Next，收益不足以抵消迁移成本。

## 后果

- 九个领域包可以脱离框架测试；80 条验收全部走 HTTP API。
- 需要一条纪律：任何写操作必须出现在 `/api` 路由清单里；评审与 lint 限制 Server Actions 的使用。
- 列表与报表用 server component 直出，编辑器用客户端组件；RSC 的缓存与 `use client` 边界成为实施注意事项。
- 单进程扛 30 单 / 天没有压力；将来要开放第三方 API 时 HTTP 层已就绪，必要时可把领域包原样搬进独立服务。
