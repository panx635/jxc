import { requireUser } from "@/server/require-user";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await requireUser();
  return (
    <section className="page-stack">
      <div className="page-heading">
        <p className="eyebrow">工作台</p>
        <h1>欢迎，{user.displayName}</h1>
        <p className="muted">
          当前角色：{user.role === "admin" ? "管理员" : "店员"}。系统骨架已就绪。
        </p>
      </div>

      <div className="metric-grid" aria-label="首页看板占位">
        <article className="metric-card">
          <p className="metric-label">今日让价</p>
          <p className="metric-value">—</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">今日作废</p>
          <p className="metric-value">—</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">负库存</p>
          <p className="metric-value">—</p>
        </article>
      </div>

      <div className="empty-state">
        <h2>还没有业务数据</h2>
        <p>首页工作台会在后续实施票中接入；现在这套骨架只负责登录、会话与健康检查。</p>
      </div>
    </section>
  );
}