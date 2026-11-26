/**
 * 权限与配置领域包（@jxc/access-control）。
 *
 * 拥有：user / can_view_cost / audit_log / 三组可配。
 * 只读依赖：全局横切。
 *
 * 边界纪律：
 * - 不 import next/*、React 或 app 层代码；不承载 HTTP。
 * - 账本表只由本模块写；跨模块读取走对方导出的查询接口。
 * - 具体接口由后续实施票在 src/ 内落地。
 */
export {};
