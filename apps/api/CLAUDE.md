# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack

NestJS 11 (Express platform), TypeScript, Jest (ts-jest) for unit tests, a separate Jest config for e2e, ESLint + Prettier.

## Commands

```bash
npm run start        # nest start
npm run start:dev    # nest start --watch (hot reload)
npm run start:debug  # nest start --debug --watch
npm run start:prod   # node dist/main (run after build)
npm run build        # nest build
npm run lint         # eslint --fix on src/apps/libs/test
npm run format       # prettier --write on src/**/*.ts and test/**/*.ts
npm run test         # jest (unit tests, *.spec.ts under src/)
npm run test:watch
npm run test:cov
npm run test:e2e     # jest -c test/jest-e2e.json (*.e2e-spec.ts under test/)
```

Run from this directory, or from the repo root with `-w api` (e.g. `npm run start:dev -w api`).

To run a single test file: `npx jest path/to/file.spec.ts`. To run a single e2e spec: `npx jest --config ./test/jest-e2e.json path/to/file.e2e-spec.ts`.

## Structure

Standard Nest CLI scaffold (`nest-cli.json`, `sourceRoot: src`): `src/main.ts` bootstraps via `NestFactory`, `src/app.module.ts` is the root module wiring `AppController`/`AppService`. No custom modules/domain logic yet — new features should follow Nest's module/controller/service convention (one module per feature, colocated `.spec.ts`).

## Formatting

`.prettierrc` (`singleQuote`, `trailingComma: "all"`, `tabWidth: 4`) mirrors `apps/web`'s — keep them in sync. A repo-wide Claude Code hook (see root `CLAUDE.md`) runs Prettier automatically after edits — you shouldn't need to run `npm run format` manually in normal use.

## Keeping documentation current

Update this file whenever a change affects what it describes (stack, scripts, structure/conventions) — in the same change, not as a follow-up. See the root `CLAUDE.md` for the repo-wide policy.
