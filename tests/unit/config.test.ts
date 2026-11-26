import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (file: string) => readFileSync(path.join(repoRoot, file), "utf8");

type ComposeService = {
  image?: string;
  depends_on?: Record<string, { condition?: string }>;
  environment?: Record<string, string>;
};

type WorkflowJob = {
  services?: Record<string, { image?: string }>;
  steps?: Array<{ run?: string }>;
};

describe("部署配置", () => {
  it("compose 用真实 PostgreSQL，app 等数据库健康后启动", () => {
    const compose = parse(read("compose.yaml")) as { services: Record<string, ComposeService> };
    expect(compose.services.db?.image).toBe("postgres:18");
    expect(compose.services.app?.depends_on?.db?.condition).toBe("service_healthy");
    expect(compose.services.app?.environment?.DATABASE_URL).toContain("@db:5432/");
  });

  it("CI 使用真实 PostgreSQL 并跑迁移、HTTP 与浏览器冒烟", () => {
    const workflow = parse(read(".github/workflows/ci.yml")) as {
      jobs: Record<string, WorkflowJob>;
    };
    const job = workflow.jobs.test;
    expect(job?.services?.postgres?.image).toBe("postgres:18");
    const commands = (job?.steps ?? []).map((step) => step.run ?? "").join("\n");
    expect(commands).toContain("pnpm db:verify");
    expect(commands).toContain("pnpm test:http");
    expect(commands).toContain("pnpm test:e2e");
  });

  it("Docker 镜像启动时先迁移种子再起服务", () => {
    expect(read("Dockerfile")).toContain("node scripts/db/setup.mjs && node scripts/server.mjs");
  });
});
