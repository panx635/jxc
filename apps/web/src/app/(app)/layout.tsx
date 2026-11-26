import { query } from "@/server/db";
import { requireUser } from "@/server/require-user";
import { LogoutButton } from "./logout-button";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await requireUser();
  const { rows } = await query<{ name: string }>("select name from shop_profile where id = 1");
  const shopName = rows[0]?.name ?? "进销存";

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">J</span>
          <span className="brand-name">{shopName}</span>
          <span className="brand-meta">进销存</span>
        </div>
        <div className="user-chip">
          <span className="user-name">{user.displayName}</span>
          <span className="role-badge">{user.role === "admin" ? "管理员" : "店员"}</span>
          <LogoutButton />
        </div>
      </header>
      <main className="app-main">{children}</main>
    </div>
  );
}
