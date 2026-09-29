import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",

    // Agent workspace (gitignored). `.claude/worktrees/*` holds full checkouts
    // of this repo, each with its own `.next` output, so linting it reported
    // ~55k problems from generated + duplicated files and made `npm run lint`
    // useless as a pre-commit gate.
    ".claude/**",

    // Build/tool output can also appear nested, not just at the repo root.
    "**/.next/**",
    "coverage/**",
    ".vercel/**",
  ]),
]);

export default eslintConfig;
