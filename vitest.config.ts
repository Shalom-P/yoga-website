import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  // Mirror the tsconfig "@/*" -> repo-root alias (tests run from the repo root).
  resolve: {
    alias: { "@": path.resolve(process.cwd()) },
  },
  test: {
    environment: "node",
    include: ["**/*.{test,spec}.ts"],
    exclude: ["node_modules", ".next"],
  },
});
