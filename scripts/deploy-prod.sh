#!/usr/bin/env bash
# The only supported production deploy: ships exactly origin/main.
#
# The Vercel CLI uploads a folder as it is on disk, not a git commit, so
# deploying from the main checkout would ship whatever branch is checked out
# plus any uncommitted edits. This script deploys a fresh detached worktree of
# origin/main instead, so the upload is clean by construction, and passes the
# commit to scripts/assert-main-deploy.mjs, which fails any production build
# that did not come through here.
#
# Usage: npm run deploy:prod
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

git fetch --quiet origin main
SHA="$(git rev-parse origin/main)"
DIR="$ROOT/.claude/worktrees/deploy-${SHA:0:7}"

echo "Deploying origin/main ${SHA:0:7}: $(git log -1 --format=%s "$SHA")"

git worktree remove --force "$DIR" 2>/dev/null || true
git worktree add --quiet --detach "$DIR" "$SHA"
trap 'git -C "$ROOT" worktree remove --force "$DIR" 2>/dev/null || true' EXIT

# The project link (.vercel/repo.json) is gitignored, so copy it in.
cp -R "$ROOT/.vercel" "$DIR/.vercel"

npx --yes vercel@latest --prod --cwd "$DIR" --build-env "MAIN_DEPLOY_SHA=$SHA"
