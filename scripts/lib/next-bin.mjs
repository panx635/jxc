import { existsSync } from "node:fs";
import path from "node:path";
import { repoRoot } from "../db/env.mjs";

export function nextBinary() {
  const binary = path.join(repoRoot, "apps", "web", "node_modules", "next", "dist", "bin", "next");
  if (!existsSync(binary)) {
    throw new Error("找不到 Next.js 可执行文件，请先运行 pnpm install。");
  }
  return binary;
}
