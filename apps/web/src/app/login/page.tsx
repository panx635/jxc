import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/current-user";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");

  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="login-brand">
          <span className="brand-mark" aria-hidden="true">J</span>
          <div>
            <p className="eyebrow">五金水暖进销存</p>
            <h1>登录</h1>
          </div>
        </div>
        <p className="muted login-intro">使用管理员或店员账号进入系统。</p>
        <LoginForm />
      </section>
    </main>
  );
}
