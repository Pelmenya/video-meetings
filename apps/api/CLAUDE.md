# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack

NestJS 11 (Express platform), TypeScript, Jest (ts-jest) for unit tests, a separate Jest config for e2e, ESLint + Prettier, Prisma 6 (ORM, Postgres), `@nestjs/cqrs` for command/event-based use cases, `@nestjs/swagger` for OpenAPI docs, `@nestjs/jwt` + `bcrypt` for auth.

Prisma is pinned to `6.19.2` (not `latest`/7.x): Prisma 7 moved the datasource `url` out of `schema.prisma` into a `prisma.config.ts` + driver-adapter setup (`@prisma/adapter-pg`), a breaking change not worth adopting for this scaffold's needs. Re-evaluate if a future task specifically wants Prisma 7's adapter model.

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

Standard Nest CLI scaffold (`nest-cli.json`, `sourceRoot: src`): `src/main.ts` bootstraps via `NestFactory`, `src/app.module.ts` is the root module. `src/app.setup.ts` exports `configureApp(app)` (global `ValidationPipe`: `whitelist`, `forbidNonWhitelisted`, `transform`) — called from both `main.ts` and every e2e spec's `beforeAll`/`beforeEach`, so tests exercise the same validation behavior as production. Don't set up the `ValidationPipe` directly in `main.ts` only; e2e tests that build the app via `@nestjs/testing` never call `bootstrap()` and would silently skip validation otherwise.

Swagger/OpenAPI is served at `/docs` (`SwaggerModule.setup('docs', ...)` in `main.ts`), generated from DTOs annotated with `@nestjs/swagger`'s `@ApiProperty`.

- `src/prisma/` — `PrismaModule` (`@Global()`) + `PrismaService` (extends `PrismaClient`, connects/disconnects on module init/destroy). Inject `PrismaService` anywhere; no need to re-import `PrismaModule` per feature module.
- `src/auth/` — first domain module, built CQRS-style with `@nestjs/cqrs`:
    - `auth.controller.ts` only dispatches `CommandBus.execute(...)`; it has no business logic.
    - `commands/impl/*.command.ts` — `RegisterCommand`/`LoginCommand`, each extends `@nestjs/cqrs`'s `Command<AuthResponseDto>` (needed for `CommandBus.execute()` to infer the correct return type instead of `unknown`).
    - `commands/handlers/*.handler.ts` — one `@CommandHandler` per command, does the actual Prisma/bcrypt/JWT work; `commands/handlers/index.ts` exports the `CommandHandlers` array registered as module providers.
    - `events/impl/user-registered.event.ts` + `events/handlers/user-registered.handler.ts` — `RegisterHandler` publishes `UserRegisteredEvent` via `EventBus` after creating the user; the handler just logs it today, but is the extension point for side effects (welcome email, analytics, etc.) that shouldn't block the register response.
    - `token.service.ts` — thin `TokenService.buildToken(userId, email)` shared by both handlers so JWT-signing isn't duplicated.
    - `dto/` — `RegisterDto`/`LoginDto` (class-validator: `@IsEmail`, `@IsString`, `@MinLength`) and `AuthResponseDto` (Swagger response shape, `{ accessToken }`).
- New feature modules should follow the same command/handler/event split once they have more than trivial logic; simple CRUD-only modules can stay a plain controller+service if CQRS would be pure ceremony — use judgment per module rather than forcing every module through CommandBus.

New modules in general still follow Nest's module/controller/service convention (colocated `.spec.ts` for unit tests, `test/*.e2e-spec.ts` for e2e).

## Database (Prisma)

- Schema: `prisma/schema.prisma` (currently just `User { id, email (unique), password, createdAt, updatedAt }`, mapped to table `users`).
- `apps/api/.env` (gitignored; copy `.env.example`) needs `DATABASE_URL` (points at the root `docker-compose.yml` Postgres — host `localhost`, port `5435`, matching the root `.env`'s `POSTGRES_*` values) plus `JWT_SECRET` and `JWT_EXPIRES_IN` (seconds — `@nestjs/jwt`'s `signOptions.expiresIn` wants `number | ms.StringValue`, not an arbitrary string, so keep this numeric).
- After changing `schema.prisma`: `npx prisma migrate dev --name <description>` (applies to the dev Postgres from `npm run db:up` and regenerates the client). `npx prisma generate` alone is enough after a fresh `npm install` wipes `node_modules` (the generated client lives under `node_modules/@prisma/client` and doesn't survive a clean reinstall).
- e2e tests (`test/auth.e2e-spec.ts`) run against the real dev Postgres, not a mock — isolation comes from generating a unique email per test (`randomUUID()`-based), not from resetting the database between runs.

## Formatting

`.prettierrc` (`singleQuote`, `trailingComma: "all"`, `tabWidth: 4`) mirrors `apps/web`'s — keep them in sync. A repo-wide Claude Code hook (see root `CLAUDE.md`) runs Prettier automatically after edits — you shouldn't need to run `npm run format` manually in normal use.

## Keeping documentation current

Update this file whenever a change affects what it describes (stack, scripts, structure/conventions) — in the same change, not as a follow-up. See the root `CLAUDE.md` for the repo-wide policy.
