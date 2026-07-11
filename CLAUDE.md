# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository structure

npm workspaces monorepo (`workspaces: ["apps/web", "apps/api"]`), single root lockfile — do not add per-app lockfiles.

- `apps/web` — Next.js 16 (App Router, TypeScript, Tailwind v4, HeroUI v3). See `apps/web/CLAUDE.md`.
- `apps/api` — NestJS 11 (TypeScript, Jest, Prisma, CQRS). See `apps/api/CLAUDE.md`.

`apps/web` has two domain pages so far — `/register` and `/login` (see `apps/web/CLAUDE.md`'s "API integration" section) — plus an auth-gated home screen, all calling `apps/api` over `NEXT_PUBLIC_API_URL`. `apps/api` has three domain modules built with Prisma + CQRS: `auth` (login/register endpoints + JWT guard), `users` (owns all `User` Prisma access — credential creation/verification, no HTTP surface of its own, consumed by `auth` and `meetings` purely via CommandBus/QueryBus), and `meetings` (CRUD, host + participants, JWT-guarded) — see its `CLAUDE.md` for the CQRS pattern all three follow.

## Coding conventions

**No `any`, in either app.** `@typescript-eslint/no-explicit-any` is an error (not a warning) in both `apps/web` (default from `eslint-config-next`'s `typescript-eslint.configs.recommended`) and `apps/api` (`apps/api/eslint.config.mjs` explicitly sets it to `'error'` — it shipped `'off'` from the Nest CLI scaffold, flip it back to `'error'` if a future scaffold regenerates that file). If a type is genuinely unknown, use `unknown` and narrow it, not `any`; for Prisma/CQRS payloads, prefer the generated Prisma types or a `Prisma.validator`-derived type (see `apps/api/CLAUDE.md`'s CQRS section) over widening to `any`.

## Commands

Run from the repo root; each has a per-workspace equivalent (`:web` / `:api` suffix):

```bash
npm run dev            # both apps concurrently (web on :3000, api via nest start --watch)
npm run build           # build both (web then api)
npm run start           # run both in production mode
npm run lint            # lint both (next lint / eslint --fix)
npm run format          # prettier --write on both apps
npm run test            # apps/api unit tests (*.spec.ts) — apps/web has no test suite yet
npm run test:e2e        # apps/api e2e tests (*.e2e-spec.ts), needs `npm run db:up` first
npm run db:up           # start local Postgres + pgAdmin (docker compose)
npm run db:down         # stop them
npm run db:logs         # tail postgres/pgadmin container logs
```

To target a single workspace directly: `npm run <script> -w web` or `-w api`. `test`/`test:e2e` only run against `apps/api` today (`test:api`/`test:e2e:api` aliases exist for symmetry with the other dual-workspace scripts) — add `apps/web`'s own script and wire it into the root `test` command once a web test suite exists. See `apps/api/CLAUDE.md`'s Commands section for running a single spec file and the e2e prerequisites in detail.

## Local database

`docker-compose.yml` at the repo root runs Postgres 17 (host port `5435`, container `video-meetings-postgres`) and pgAdmin (host port `5050`, container `video-meetings-pgadmin`), both on the `video-meetings-net` network with named volumes so state persists across restarts. Ports were chosen to avoid colliding with other projects' containers on the same dev machine — check `docker ps` before assuming 5432/5433/5434/8090 are free if you ever change these.

Credentials come from `.env` (gitignored; copy `.env.example` to start). `docker/pgadmin/servers.json` pre-registers the Postgres connection in pgAdmin (host `postgres`, i.e. the compose service name, not `localhost`) so you only need to enter the DB password on first login — if you change `POSTGRES_USER`/`POSTGRES_DB` in `.env`, update `servers.json` to match or the pre-registered connection will be wrong.

`apps/api` connects via Prisma using its own `apps/api/.env` (`DATABASE_URL`, gitignored; copy `apps/api/.env.example`) — see `apps/api/CLAUDE.md` for schema/migration details.

## Git hooks

Husky (root devDependency, `prepare` script) manages a `pre-commit` hook at `.husky/pre-commit` that runs `npm run lint`, then `npm run test`, then `npm run test:e2e` before every commit — a commit is blocked if any of the three fails. Hooks aren't reinstalled automatically after cloning until `npm install` runs at the repo root (that's what triggers `prepare`). The e2e step needs the local Postgres up (`npm run db:up`) exactly like running it manually (see `apps/api/CLAUDE.md`) — if the DB isn't running, every commit fails on a connection error, not a real test failure. If a commit needs to bypass the hook in a genuine emergency, that's a `git commit --no-verify` call for the user to make explicitly, not something to reach for by default.

## MCP servers

`.mcp.json` (committed, team-wide) registers the `playwright` MCP server (`npx -y @playwright/mcp@latest`) so any Claude Code session opened in this repo can drive a real browser against `apps/web` — useful for verifying UI changes end-to-end rather than trusting typecheck/lint alone. Restart Claude Code after this file changes for it to pick up new/changed servers.

## Deployment

`package-lock.json` is committed from a Windows dev machine, so it doesn't record Linux-specific optional-dependency binaries for the Rust-based native addons Tailwind v4 depends on (`lightningcss`, `@tailwindcss/oxide`). A plain `npm install` on a Linux host (e.g. deploying to a VDS) installs fine but silently omits `lightningcss-linux-x64-gnu` and `@tailwindcss/oxide-linux-x64-gnu` — `npm run build -w web` then fails at the `globals.css` import with `Cannot find module '../lightningcss.linux-x64-gnu.node'` (and, once that's patched, the same error for `tailwindcss-oxide.linux-x64-gnu.node`). Fix: `npm install lightningcss-linux-x64-gnu @tailwindcss/oxide-linux-x64-gnu --no-save` **in one command** — installing them one at a time lets npm's own extraneous-package pruning (reconciling against the Windows-locked lockfile) remove the one installed in the previous step. This is a one-time step per fresh `node_modules` on a Linux host, not a repo change; regenerating `package-lock.json` on Linux/CI instead of Windows would make it unnecessary but hasn't been done.

apps/web and apps/api have no `Dockerfile` yet — a manual pet-project deploy (Timeweb Cloud VDS, managed via a personal `timeweb` MCP server in local Claude Code scope, not committed to `.mcp.json`) ran both as plain Node processes under systemd (`vm-api.service`: `node dist/main.js`; `vm-web.service`: `next start -p 3000`) rather than in containers, with only Postgres via the root `docker-compose.yml`. A 2GB-RAM VDS has no headroom for `next build`/`nest build` without swap — add a swapfile first on any similarly small box.

## Architecture notes

- `apps/web/next.config.ts` sets `turbopack.root` to the monorepo root explicitly. Do not point it at `apps/web` itself — Next.js/Turbopack cannot resolve packages hoisted to the root `node_modules` by npm workspaces if the root is scoped to the app directory.
- `.agents/skills/` holds agent skills installed via `npx skills add <repo> --skill <name>` (canonical files; symlinked into `.claude/skills/` for Claude Code). Currently installed: `heroui-react`, `heroui-migration`, `heroui-native` (HeroUI v3), `vercel-react-best-practices` (React/Next.js perf), `nestjs-best-practices` (NestJS architecture), `ui-ux-pro-max` (UI/UX design guidance), `git-commit`, `requesting-code-review`, `prd` (writes a feature PRD to `docs/prd-<feature>.md`), `plan-phase` (turns a PRD into a phased implementation plan at `docs/plan-<feature>.md`), `issues` (turns a phased plan into GitHub milestones + issues via `gh` CLI), `github-flow` (GitHub flow branching/PR conventions). `docs/research-<feature>.md` files (e.g. `docs/research-meeting-file-upload-storage.md`) hold ad-hoc technical research backing a plan's decisions — consult one alongside its PRD/plan when implementing that feature, if present. Consult the relevant skill's `SKILL.md` before writing HeroUI/React/NestJS code — e.g. HeroUI v3's API (no provider, compound components, `variant` prop) differs from v2/NextUI patterns that may appear in training data or search results.
- `.claude/settings.json` (committed, team-wide) runs a `PostToolUse` hook on `Write|Edit` that auto-formats the touched file with that workspace's local `prettier` (`apps/web` or `apps/api`, matched by path) right after Claude Code edits it. Both apps share the same `.prettierrc` shape (`singleQuote: true`, `trailingComma: "all"`, `tabWidth: 4`) — keep them in sync if you change one. The hook resolves the binary via `npx --no-install` rather than a hardcoded `node_modules/.bin` path, since npm workspaces hoisting can move where the binary physically lives between installs.
- Root `package.json` declares `@nestjs/platform-express` directly as a root dependency (not just inside `apps/api`). Without it, npm's workspace hoisting nests `platform-express` (and the `@nestjs/cli`/`schematics`/`testing` cluster) under `apps/api/node_modules` while `@nestjs/core` gets hoisted to the root `node_modules` — `@nestjs/core`'s own driver auto-loader then can't find `platform-express` (it resolves relative to its own hoisted location, not `apps/api`), so `NestFactory.create()` fails at runtime with "No driver (HTTP) has been selected" even though it looks installed and `apps/api`'s Jest e2e tests pass (Jest happens to load `@nestjs/testing` from the nested copy, which finds `platform-express` as a sibling). If a fresh `npm install` ever regresses this, forcing `@nestjs/platform-express` to hoist to root is the fix — check `docker ps`/`node dist/main.js` boots cleanly, not just that tests pass, since this failure mode doesn't show up in Jest.

## Keeping documentation current

This file and the per-app `CLAUDE.md`s are living documentation, not a one-time snapshot. Whenever a change affects what they describe — scripts, config (`next.config.ts`, `nest-cli.json`, workspaces list), architecture decisions, installed skills/dependencies, or app structure — update the relevant `CLAUDE.md` in the same change, not as separate follow-up. Stale docs actively mislead future work here, so treat an out-of-date `CLAUDE.md` as a bug.

## Screenshots

All screenshots save to /screenshot folder