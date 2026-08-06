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
    // Globs, not bare names: a bare "node_modules" doesn't match nested copies,
    // so stale .claude/worktrees checkouts (with their own node_modules) were
    // being collected and failing the whole run.
    exclude: ["**/node_modules/**", "**/.next/**", ".claude/**"],
  },
});
