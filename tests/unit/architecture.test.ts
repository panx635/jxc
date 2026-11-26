import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const packagesRoot = path.join(repoRoot, "packages");
const appRoot = path.join(repoRoot, "apps", "web", "src", "app");
const manifestPath = path.join(repoRoot, "docs", "architecture", "write-endpoints.md");

const DOMAIN_PACKAGES = {
  "master-data": { name: "@jxc/master-data", allowed: [] },
  "document-core": { name: "@jxc/document-core", allowed: ["master-data"] },
  "inventory-ledger": { name: "@jxc/inventory-ledger", allowed: ["master-data", "document-core"] },
  "party-ledger": { name: "@jxc/party-ledger", allowed: ["master-data", "document-core"] },
  "cash-ledger": { name: "@jxc/cash-ledger", allowed: ["master-data", "document-core"] },
  "reporting": {
    name: "@jxc/reporting",
    allowed: ["master-data", "document-core", "inventory-ledger", "party-ledger", "cash-ledger"],
  },
  "printing": { name: "@jxc/printing", allowed: ["master-data", "document-core"] },
  "access-control": { name: "@jxc/access-control", allowed: [] },
  "opening-import": {
    name: "@jxc/opening-import",
    allowed: ["master-data", "document-core", "inventory-ledger", "party-ledger", "cash-ledger"],
  },
} as const;

type DomainDir = keyof typeof DOMAIN_PACKAGES;

function walk(directory: string): string[] {
  if (!statSync(directory).isDirectory()) return [directory];
  return readdirSync(directory).flatMap((entry) => {
    if (entry === "node_modules" || entry === ".next") return [];
    return walk(path.join(directory, entry));
  });
}

function sourceFiles(directory: string): string[] {
  return walk(directory).filter((file) => /\.(?:[cm]?[jt]sx?)$/.test(file));
}

function importSpecifiers(source: string): string[] {
  const specifiers: string[] = [];
  const pattern = /(?:from\s+|import\s*\(\s*|require\s*\(\s*)["']([^"']+)["']/g;
  for (const match of source.matchAll(pattern)) specifiers.push(match[1]!);
  return specifiers;
}

describe("九个领域包", () => {
  it("按规格 §12.1 建好九个包，每个包有 src/index.ts", () => {
    const dirs = readdirSync(packagesRoot)
      .filter((entry) => statSync(path.join(packagesRoot, entry)).isDirectory())
      .sort();
    expect(dirs).toEqual(Object.keys(DOMAIN_PACKAGES).sort());

    for (const dir of dirs) {
      expect(statSync(path.join(packagesRoot, dir, "src", "index.ts")).isFile()).toBe(true);
    }
  });

  it("包内不依赖框架，也不 import app 层", () => {
    for (const [dir, definition] of Object.entries(DOMAIN_PACKAGES)) {
      const packageJson = JSON.parse(
        readFileSync(path.join(packagesRoot, dir, "package.json"), "utf8"),
      ) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
      const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
      for (const forbidden of ["next", "react", "react-dom", "@jxc/web"]) {
        expect(dependencies[forbidden], `${dir} 不应依赖 ${forbidden}`).toBeUndefined();
      }

      const allowed = new Set([
        ...definition.allowed.map((key) => DOMAIN_PACKAGES[key as DomainDir].name),
        "@jxc/access-control",
      ]);
      for (const dependency of Object.keys(dependencies)) {
        if (!dependency.startsWith("@jxc/")) continue;
        expect(allowed.has(dependency), `${dir} 依赖了不允许的包 ${dependency}`).toBe(true);
      }

      for (const file of sourceFiles(path.join(packagesRoot, dir, "src"))) {
        for (const specifier of importSpecifiers(readFileSync(file, "utf8"))) {
          expect(specifier, `${file} import 了框架`).not.toMatch(/^(?:next(?:\/|$)|react(?:\/|$)|react-dom(?:\/|$))/);
          expect(specifier, `${file} import 了 app 层`).not.toMatch(/^(?:@\/|apps\/|@jxc\/web)/);
          if (specifier.startsWith("@jxc/")) {
            expect(allowed.has(specifier), `${file} import 了不允许的包 ${specifier}`).toBe(true);
          }
        }
      }
    }
  });
});

describe("HTTP 写边界", () => {
  it("写 handler 只出现在 app/api 的 route 文件里", () => {
    const violations: string[] = [];
    for (const file of sourceFiles(appRoot)) {
      if (!/\/route\.(?:[cm]?[jt]sx?)$/.test(file)) continue;
      const source = readFileSync(file, "utf8");
      const writes = [...source.matchAll(/export\s+(?:async\s+)?(?:function\s+|const\s+)(POST|PUT|PATCH|DELETE)\b/g)]
        .map((match) => match[1]);
      if (writes.length === 0) continue;
      const relative = path.relative(appRoot, file).split(path.sep).join("/");
      if (!relative.startsWith("api/")) {
        violations.push(`${relative} 导出了 ${writes.join(", ")}，但不在 /api 下`);
      }
    }
    expect(violations).toEqual([]);
  });

  it("每个写端点都登记在 docs/architecture/write-endpoints.md", () => {
    const manifest = readFileSync(manifestPath, "utf8");
    const routes = sourceFiles(appRoot)
      .filter((file) => /\/route\.(?:[cm]?[jt]sx?)$/.test(file))
      .map((file) => {
        const relative = path.relative(appRoot, file).split(path.sep).join("/");
        const source = readFileSync(file, "utf8");
        const methods = [...source.matchAll(/export\s+(?:async\s+)?(?:function\s+|const\s+)(POST|PUT|PATCH|DELETE)\b/g)]
          .map((match) => match[1]!);
        const routePath = "/" + relative.replace(/\/route\.(?:[cm]?[jt]sx?)$/, "");
        return methods.map((method) => `${method} ${routePath}`);
      })
      .flat();

    for (const endpoint of routes) {
      expect(manifest, `写端点 ${endpoint} 没登记`).toContain(endpoint);
    }
  });

  it("全站不使用 Server Actions", () => {
    const violations = sourceFiles(path.join(repoRoot, "apps", "web", "src"))
      .filter((file) => /["']use server["']/.test(readFileSync(file, "utf8")));
    expect(violations).toEqual([]);
  });
});