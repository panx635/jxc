/**
 * 单据核心领域包（@jxc/document-core）。
 *
 * 拥有：doc / doc_version / 各单据行表 / 编号 / 状态机 / 幂等。
 * 只读依赖：主数据。
 *
 * 边界纪律：
 * - 不 import next/*、React 或 app 层代码；不承载 HTTP。
 * - 账本表只由本模块写；跨模块读取走对方导出的查询接口。
 * - 具体接口由后续实施票在 src/ 内落地。
 */
export {};
