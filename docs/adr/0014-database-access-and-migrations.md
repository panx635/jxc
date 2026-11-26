# 数据访问与迁移：node-postgres + 手写上下迁移，不采用 ORM

**状态**：已采纳（2026-11-26，实施票 #17「应用骨架、登录与测试底座」）

ADR 0013 把 ORM 与迁移工具留给实施首票决定。本票决定：用 `pg` 直连 PostgreSQL，迁移是成对的手写 SQL（up / down），不引入 Prisma 或 Drizzle。

## 决定

- **数据访问用 `pg`**：领域包保持纯 TypeScript，不依赖 ORM；SQL 由所属模块拥有，应用层只负责连接池、会话与 `SqlClient` 适配。登录所需的用户与店铺档案读取已放在 `@jxc/access-control`。
- **迁移是一对 SQL 文件**：`db/migrations/NNNN_name.up.sql` 与 `NNNN_name.down.sql`。加载迁移时缺 down 文件直接报错，不允许出现不可回滚的迁移。
- **迁移账本 `schema_migrations`**：记录版本、名称、up SQL 的 SHA-256 与时间。已应用文件被改动会拒绝启动；每个迁移在独立事务里执行；用 PostgreSQL advisory lock 串行化并发迁移。
- **不自动迁移**：`pnpm db:setup` 负责建库、迁移、种子；应用启动只连库。`pnpm dev` 为本地开发把这三步串起来，生产部署把 `pnpm db:setup` 作为发布步骤。
- **种子可重复执行**：按唯一键幂等插入，已存在的数据不覆盖；管理员只在首次创建时写入密码哈希，重复种子不重置密码。
- **会话**：不透明随机 token，数据库只存 SHA-256；HttpOnly + SameSite=Lax Cookie，30 天过期。角色与启用状态每次请求从库读，权限变更立即生效。
- **本地开发可选自举**：没有 `DATABASE_URL` 且本机有 PostgreSQL 二进制时，`.local/pgdata` 起一个只监听 127.0.0.1:55432 的集群；生产必须显式配置 `DATABASE_URL`。

## 考虑过的方案

- **Prisma**：类型与迁移体验好，但 `prisma migrate` 的原生模型是向前迁移，down 要另写或手工处理；生成的 client 也把领域包绑在 ORM 上。
- **Drizzle**：SQL 风格接近手写，但迁移工具同样以向前迁移为主；为一个以账本不变量与实时报表为中心的系统引入 schema DSL，收益不抵约束成本。
- **手写 SQL + 自家 runner**：牺牲 ORM 的便利，换来显式 down、可读的账本 SQL、零框架依赖的领域包；迁移数量到几十个时仍可控。

## 后果

- 每个迁移都要写 up 与 down，评审时一并看；`pnpm db:verify` 在一次性数据库上做「应用 → 全量回滚 → 重新应用 → 种子跑两遍」的证明。
- 账本查询与约束直接写在 SQL 里，金额、日期、时区口径不被 ORM 隐式转换。
- 迁移文件是契约：改了已应用的 up SQL 会被 checksum 拒绝；需要修正时新增迁移，不改历史。
- 后续若账本表与查询复杂度显著上升，可引入只读查询构造器；迁移机制不随之改变。