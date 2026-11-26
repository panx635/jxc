import { describe, expect, it } from "vitest";
import { ApiClient } from "../support/api-client";

const baseUrl = process.env.JXC_BASE_URL || "http://127.0.0.1:3101";
const username = process.env.SEED_ADMIN_USERNAME ?? "admin";
const password = process.env.SEED_ADMIN_PASSWORD ?? "admin12345";
const displayName = process.env.SEED_ADMIN_DISPLAY_NAME ?? "管理员";

describe("GET /api/health", () => {
  it("报告真实数据库可用", async () => {
    const response = await fetch(`${baseUrl}/api/health`);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { status?: string; checks?: { database?: string } };
    expect(body.status).toBe("ok");
    expect(body.checks?.database).toBe("ok");
  });
});

describe("管理员会话", () => {
  it("未登录访问首页重定向到登录页", async () => {
    const client = new ApiClient(baseUrl);
    const response = await client.fetch("/");
    expect([302, 303, 307, 308]).toContain(response.status);
    const location = response.headers.get("location");
    expect(location).toBeTruthy();
    expect(new URL(location!, baseUrl).pathname).toBe("/login");
  });

  it("错误密码不建立会话", async () => {
    const client = new ApiClient(baseUrl);
    const response = await client.postJson("/api/auth/login", {
      username,
      password: "definitely-not-the-password",
    });
    expect(response.status).toBe(401);
    expect(client.hasSessionCookie).toBe(false);
  });

  it("登录后能打开首页，退出后会话失效", async () => {
    const client = new ApiClient(baseUrl);

    const login = await client.postJson("/api/auth/login", { username, password });
    expect(login.status).toBe(200);
    expect(client.hasSessionCookie).toBe(true);
    const setCookie = login.headers.getSetCookie().join(";");
    expect(setCookie).toContain("jxc_session=");
    expect(setCookie.toLowerCase()).toContain("httponly");

    const home = await client.fetch("/");
    expect(home.status).toBe(200);
    expect(await home.text()).toContain(displayName);

    const logout = await client.postJson("/api/auth/logout", {});
    expect(logout.status).toBe(200);
    expect(client.hasSessionCookie).toBe(false);

    const afterLogout = await client.fetch("/");
    expect([302, 303, 307, 308]).toContain(afterLogout.status);
  });
});