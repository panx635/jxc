# 五金水暖进销存（jxc）

单公司、单仓的进销存 Web 应用。Next.js App Router + TypeScript + PostgreSQL；领域逻辑在九个不依赖框架的包里（规格见 `docs/spec/v1.md`，验收见 `docs/spec/v1-acceptance.md`）。

当前是应用底座：数据库、迁移、种子、会话登录、空首页、健康检查，以及 HTTP / 浏览器测试接缝。业务功能按 `#16` 下的实施票逐张落地。

## 一条命令（Docker，全新环境）

要求：Docker Compose v2。

```bash
docker compose up --build
```

`db` 容器起 PostgreSQL，`app` 容器启动时自动建库、迁移、种子，然后监听 http://localhost:3000 。登录账号仍是 `admin` / `admin12345`（可用 `SEED_ADMIN_PASSWORD` 覆盖）。重来一遍：`docker compose down -v`。

compose 本地走 http，所以设置了 `JXC_INSECURE_COOKIES=1`；正式部署走 HTTPS 时删掉这一项。生产也可以不用 Docker：按下面的 `pnpm db:setup` → `pnpm build` → `pnpm start` 顺序部署。

## 快速开始（本机 Node）

要求：Node.js ≥ 24、pnpm 12、PostgreSQL 18。

```bash
pnpm install
pnpm dev
```

`pnpm dev` 会按顺序完成：建库（不存在时）→ 迁移 → 种子 → 启动开发服务器。没有配置 `DATABASE_URL` 时，如果本机装了 PostgreSQL，会自动在 `.local/pgdata` 初始化一个只监听 `127.0.0.1:55432` 的开发集群；生产中始终显式配置 `DATABASE_URL`。

打开 http://localhost:3000 ，用种子管理员登录：

- 用户名：`admin`（`SEED_ADMIN_USERNAME`）
- 密码：`admin12345`（`SEED_ADMIN_PASSWORD`，仅开发默认值）

停止本地集群：`pnpm db:local:stop`。

## 常用命令

| 命令 | 作用 |
| --- | --- |
| `pnpm dev` | 建库 + 迁移 + 种子 + 启动开发服务器 |
| `pnpm build` / `pnpm start` | 生产构建 / 启动（先 `pnpm db:setup`；`start` 要求显式 `DATABASE_URL`） |
| `pnpm db:setup` | 建库、应用迁移、跑种子（可重复） |
| `pnpm db:migrate` / `pnpm db:rollback` | 应用待执行迁移 / 回滚全部迁移 |
| `pnpm db:seed` | 只跑种子 |
| `pnpm db:verify` | 在一次性数据库上验证迁移可回滚、种子可重复 |
| `pnpm typecheck` | 所有工作区 TypeScript 检查 |
| `pnpm test:unit` | 架构边界测试（包依赖、写端点清单、Server Actions） |
| `pnpm test:http` | 真实 PostgreSQL + 生产构建上的 HTTP 测试 |
| `pnpm test:e2e` | Playwright 浏览器冒烟 |

首次跑 HTTP / 浏览器测试前先 `pnpm build`；测试脚本在缺构建时会自己补，但 CI 里显式构建一次。

测试只碰独立数据库：本地默认 `jxc_test`（会自动拉起 `.local` 集群并建库），CI 用 service 容器的 `jxc_test`。要换测试库时显式设置 `JXC_TEST_DATABASE_URL`，不会隐式复用 `DATABASE_URL`。

浏览器冒烟前先安装 Playwright 的 Chromium：`pnpm exec playwright install chromium`。本机已有 Edge 时也可以用 `PLAYWRIGHT_CHANNEL=msedge pnpm test:e2e` 跳过下载。

## 目录

```text
apps/web              Next.js 应用：页面、/api Route Handlers、会话接线
packages/             九个领域包（规格 §12.1），不 import next/* 或 React
db/migrations/        NNNN_name.up.sql / .down.sql，成对出现
scripts/db/           建库、迁移 runner、种子、回滚验证
tests/unit/           架构边界测试
tests/http/           走 HTTP API 接缝的测试
e2e/                  Playwright 浏览器冒烟
docs/architecture/    写端点清单（新增写操作必须登记）
```

依赖方向与写边界由 `tests/unit/architecture.test.ts` 守住；数据访问与迁移的决定见 `docs/adr/0014-database-access-and-migrations.md`。

## 环境变量

| 变量 | 说明 |
| --- | --- |
| `DATABASE_URL` | PostgreSQL 连接串；生产必填 |
| `SEED_ADMIN_USERNAME` / `SEED_ADMIN_PASSWORD` / `SEED_ADMIN_DISPLAY_NAME` | 首次种子管理员；重复种子不重置密码 |
| `SEED_SHOP_NAME` | 店铺档案名称，默认「五金水暖」 |
| `PG_BIN` | 本地自举时 PostgreSQL `bin` 目录，找不到二进制时使用 |
| `JXC_TEST_DATABASE_URL` | 测试专用数据库；本地默认 `jxc_test`，CI 由 workflow 提供 |
| `JXC_INSECURE_COOKIES` | 仅本地 / CI 的 http 环境设为 `1`；生产保持未设置以启用 Secure Cookie |

生产部署顺序：配置 `DATABASE_URL` → `pnpm db:setup` → `pnpm build` → `pnpm start`。`pnpm start` 不会自举本地集群，缺 `DATABASE_URL` 会直接失败。

## CI

`.github/workflows/ci.yml` 使用真实 `postgres:18` 服务容器，执行类型检查、迁移 / 回滚验证、构建、架构测试、HTTP 测试和 Playwright 冒烟；不 mock 存储。