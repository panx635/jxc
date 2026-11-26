# 九个领域包

规格 §12.1 的九个模块，一个模块一个包，代码按模块组织，不按 controller / service / repository 分层。

| 包 | 模块 | 拥有 | 只读依赖 |
| --- | --- | --- | --- |
| `@jxc/master-data` | 主数据 | 商品 / 单位 / 别名 / 品牌 / 分类；客户 / 供应商 / 分组；价格表与规则；资金账户；收支项目 | 无 |
| `@jxc/document-core` | 单据核心 | doc / doc_version / 各单据行表 / 编号 / 状态机 / 幂等 | 主数据 |
| `@jxc/inventory-ledger` | 库存账 | stock_movement / stock_balance / 成本重放 / 负库存 / 盘点 | 单据核心、主数据 |
| `@jxc/party-ledger` | 往来账 | party_entry / party_settlement / 账龄 / 对账单 / 对账记录 | 单据核心、主数据 |
| `@jxc/cash-ledger` | 资金账 | cash_entry / 账户余额 / 转账 / 日常收支 / 采购运费入账 | 单据核心、主数据 |
| `@jxc/reporting` | 报表 | 四张表的查询定义（页面与导出共用） | 库存 / 往来 / 资金 |
| `@jxc/printing` | 打印 | 模板注册、数据契约组装、打印留痕 | 单据核心、主数据 |
| `@jxc/access-control` | 权限与配置 | user / can_view_cost / audit_log / 三组可配 | 全局横切 |
| `@jxc/opening-import` | 期初与导入 | 三类期初单 / 导入批次 / 启用日校验 | 单据核心、主数据、三本账 |

依赖方向：主数据 ← 单据核心 ← 库存账 / 往来账 / 资金账 ← 报表；打印依赖单据核心；权限横切；期初与导入依赖单据核心与三本账。

纪律由 `tests/unit/architecture.test.ts` 守住：

- 包内禁止 import `next/*`、React、`apps/web` 或 `@jxc/web`。
- 包之间的 workspace 依赖只允许规格 §12.1 的方向；`@jxc/access-control` 作为横切包可被任何模块依赖。
- 写操作只能出现在 `apps/web/src/app/api/**/route.ts`，且必须登记在 `docs/architecture/write-endpoints.md`。
