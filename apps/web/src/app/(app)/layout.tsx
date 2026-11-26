import { getShopName } from "@jxc/access-control";
import { accessStore } from "@/server/access-store";
import { requireUser } from "@/server/require-user";
import { LogoutButton } from "./logout-button";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await requireUser();
  const shopName = (await getShopName(accessStore)) ?? "进销存";

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
