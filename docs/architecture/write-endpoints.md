# 写端点清单

规格 §12.1 与 ADR 0013：写操作只走 `/api` 的 Route Handlers，不使用 Server Actions；任何写端点都必须同时登记在这里。

`tests/unit/architecture.test.ts` 会扫描 `apps/web/src/app`：

- 导出 `POST` / `PUT` / `PATCH` / `DELETE` 的文件必须位于 `app/api/**/route.ts`；
- 每个写端点都必须在下面出现；
- 全站禁止 `"use server"` 指令。

新增端点时，先改这里，再写路由。

- `POST /api/auth/login` — 登录，建立 30 天会话（#17）
- `POST /api/auth/logout` — 退出，撤销当前会话（#17）
