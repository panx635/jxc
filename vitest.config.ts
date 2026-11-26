import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/unit/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "http",
          environment: "node",
          include: ["tests/http/**/*.test.ts"],
          globalSetup: ["./tests/support/global-server.ts"],
          testTimeout: 30_000,
          hookTimeout: 180_000,
          fileParallelism: false,
        },
      },
    ],
  },
});
