"use client";

import { useState } from "react";

type LoginError = { error?: { message?: string } };

export function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ username, password }),
      });

      if (response.ok) {
        window.location.assign("/");
        return;
      }

      const body = (await response.json().catch(() => ({}))) as LoginError;
      setError(body.error?.message ?? "登录失败，请稍后再试。");
    } catch {
      setError("网络异常，请检查连接后重试。");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="login-form" onSubmit={onSubmit}>
      <label className="field">
        <span>用户名</span>
        <input
          name="username"
          autoComplete="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          required
          autoFocus
        />
      </label>
      <label className="field">
        <span>密码</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </label>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <button className="primary-button" type="submit" disabled={pending}>
        {pending ? "登录中…" : "登录"}
      </button>
    </form>
  );
}
