/**
 * 库存账领域包（@jxc/inventory-ledger）。
 *
 * 拥有：stock_movement / stock_balance / 成本重放 / 负库存 / 盘点。
 * 只读依赖：单据核心、主数据。
 *
 * 边界纪律：
 * - 不 import next/*、React 或 app 层代码；不承载 HTTP。
 * - 账本表只由本模块写；跨模块读取走对方导出的查询接口。
 * - 具体接口由后续实施票在 src/ 内落地。
 */
export {};
