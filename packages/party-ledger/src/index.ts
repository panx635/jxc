/**
 * 往来账领域包（@jxc/party-ledger）。
 *
 * 拥有：party_entry / party_settlement / 账龄 / 对账单 / 对账记录。
 * 只读依赖：单据核心、主数据。
 *
 * 边界纪律：
 * - 不 import next/*、React 或 app 层代码；不承载 HTTP。
 * - 账本表只由本模块写；跨模块读取走对方导出的查询接口。
 * - 具体接口由后续实施票在 src/ 内落地。
 */
export {};
