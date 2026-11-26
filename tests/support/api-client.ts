export class ApiClient {
  private readonly cookies = new Map<string, string>();

  constructor(private readonly baseUrl: string) {}

  get hasSessionCookie(): boolean {
    return this.cookies.has("jxc_session");
  }

  async fetch(pathname: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    if (this.cookies.size > 0) {
      headers.set(
        "cookie",
        [...this.cookies.entries()].map(([name, value]) => `${name}=${value}`).join("; "),
      );
    }

    const response = await fetch(new URL(pathname, this.baseUrl), {
      ...init,
      headers,
      redirect: init.redirect ?? "manual",
    });

    for (const rawCookie of response.headers.getSetCookie()) {
      const [pair] = rawCookie.split(";");
      if (!pair) continue;
      const separator = pair.indexOf("=");
      if (separator <= 0) continue;
      const name = pair.slice(0, separator);
      const value = pair.slice(separator + 1);
      if (!value || /max-age=0/i.test(rawCookie)) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
    return response;
  }

  postJson(pathname: string, body: unknown): Promise<Response> {
    return this.fetch(pathname, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }
}
