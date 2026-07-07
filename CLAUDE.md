# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository structure

npm workspaces monorepo (`workspaces: ["apps/web", "apps/api"]`), single root lockfile — do not add per-app lockfiles.

- `apps/web` — Next.js 16 (App Router, TypeScript, Tailwind v4, HeroUI v3). See `apps/web/CLAUDE.md`.
- `apps/api` — NestJS 11 (TypeScript, Jest). See `apps/api/CLAUDE.md`.

Both apps are currently at initial scaffold state (framework defaults, no custom domain code yet).

## Commands

Run from the repo root; each has a per-workspace equivalent (`:web` / `:api` suffix):

```bash
npm run dev            # both apps concurrently (web on :3000, api via nest start --watch)
npm run build           # build both (web then api)
npm run start           # run both in production mode
npm run lint            # lint both (next lint / eslint --fix)
npm run format          # prettier --write on both apps
npm run db:up           # start local Postgres + pgAdmin (docker compose)
npm run db:down         # stop them
npm run db:logs         # tail postgres/pgadmin container logs
```

To target a single workspace directly: `npm run <script> -w web` or `-w api`.

## Local database

`docker-compose.yml` at the repo root runs Postgres 17 (host port `5435`, container `video-meetings-postgres`) and pgAdmin (host port `5050`, container `video-meetings-pgadmin`), both on the `video-meetings-net` network with named volumes so state persists across restarts. Ports were chosen to avoid colliding with other projects' containers on the same dev machine — check `docker ps` before assuming 5432/5433/5434/8090 are free if you ever change these.

Credentials come from `.env` (gitignored; copy `.env.example` to start). `docker/pgadmin/servers.json` pre-registers the Postgres connection in pgAdmin (host `postgres`, i.e. the compose service name, not `localhost`) so you only need to enter the DB password on first login — if you change `POSTGRES_USER`/`POSTGRES_DB` in `.env`, update `servers.json` to match or the pre-registered connection will be wrong.

No ORM/driver is wired into `apps/api` yet — this is just the database service, not application code.

## Architecture notes

- `apps/web/next.config.ts` sets `turbopack.root` to the monorepo root explicitly. Do not point it at `apps/web` itself — Next.js/Turbopack cannot resolve packages hoisted to the root `node_modules` by npm workspaces if the root is scoped to the app directory.
- `.agents/skills/` holds agent skills installed via `npx skills add <repo> --skill <name>` (canonical files; symlinked into `.claude/skills/` for Claude Code). Currently installed: `heroui-react`, `heroui-migration`, `heroui-native` (HeroUI v3), `vercel-react-best-practices` (React/Next.js perf), `nestjs-best-practices` (NestJS architecture), `git-commit`, `requesting-code-review`. Consult the relevant skill's `SKILL.md` before writing HeroUI/React/NestJS code — e.g. HeroUI v3's API (no provider, compound components, `variant` prop) differs from v2/NextUI patterns that may appear in training data or search results.
- `.claude/settings.json` (committed, team-wide) runs a `PostToolUse` hook on `Write|Edit` that auto-formats the touched file with that workspace's local `prettier` (`apps/web` or `apps/api`, matched by path) right after Claude Code edits it. Both apps share the same `.prettierrc` shape (`singleQuote: true`, `trailingComma: "all"`, `tabWidth: 4`) — keep them in sync if you change one. The hook resolves the binary via `npx --no-install` rather than a hardcoded `node_modules/.bin` path, since npm workspaces hoisting can move where the binary physically lives between installs.

## Keeping documentation current

This file and the per-app `CLAUDE.md`s are living documentation, not a one-time snapshot. Whenever a change affects what they describe — scripts, config (`next.config.ts`, `nest-cli.json`, workspaces list), architecture decisions, installed skills/dependencies, or app structure — update the relevant `CLAUDE.md` in the same change, not as separate follow-up. Stale docs actively mislead future work here, so treat an out-of-date `CLAUDE.md` as a bug.
