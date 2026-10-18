// Production builds must be a clean copy of origin/main.
//
// Runs before `next build` (see package.json). On Vercel, a production build
// fails here unless it was started by scripts/deploy-prod.sh, which deploys a
// fresh detached worktree of origin/main and passes that commit as
// MAIN_DEPLOY_SHA. A bare `npx vercel --prod` from a feature branch or a dirty
// checkout therefore fails at build time, and a failed build never replaces
// the live deployment.
//
// The Vercel CLI records the uploading checkout's commit as
// VERCEL_GIT_COMMIT_SHA / VERCEL_GIT_COMMIT_REF. Both are checked when present.
// Previews and local builds are not affected.

if (process.env.VERCEL_ENV !== "production") process.exit(0);

const expected = process.env.MAIN_DEPLOY_SHA;
const sha = process.env.VERCEL_GIT_COMMIT_SHA;
const ref = process.env.VERCEL_GIT_COMMIT_REF;

function fail(reason) {
  console.error(`\n[deploy guard] ${reason}`);
  console.error("[deploy guard] Production deploys only ship origin/main. Run: npm run deploy:prod\n");
  process.exit(1);
}

if (!expected) fail("MAIN_DEPLOY_SHA is not set, so this deploy did not come from scripts/deploy-prod.sh.");
if (ref && ref !== "main" && ref !== "HEAD") fail(`Uploaded from branch "${ref}", not main.`);
if (sha && sha !== expected) fail(`Uploaded commit ${sha} is not origin/main (${expected}).`);

console.log(`[deploy guard] OK: production build of origin/main ${expected.slice(0, 7)}`);
