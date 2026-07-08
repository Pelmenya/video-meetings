# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack

Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind CSS v4, ESLint (`eslint-config-next`), Prettier, HeroUI v3 (`@heroui/react` + `@heroui/styles`).

## Commands

```bash
npm run dev      # next dev (Turbopack), http://localhost:3000
npm run build    # next build
npm run start    # next start (serves the production build)
npm run lint     # eslint
npm run format   # prettier --write on src/**/*.{ts,tsx,css}
```

Run from this directory, or from the repo root with `-w web` (e.g. `npm run dev -w web`).

## HeroUI v3

`@heroui/react` here is v3, which is architecturally different from v2/NextUI — do not apply v2 patterns from memory or older tutorials:

- **No `HeroUIProvider`.** Root layout just imports `./globals.css` directly.
- **No `framer-motion`.** Animations are CSS-based.
- **Compound components**: `<Card><Card.Header>...` instead of flat props like `<Card title="x">`.
- **Semantic `variant` prop** (`primary`, `secondary`, `tertiary`, `danger`, `ghost`, `outline`), not a `color` prop.
- CSS import order in `src/app/globals.css` matters: `@import "tailwindcss";` must come before `@import "@heroui/styles";`.

Before implementing or modifying HeroUI components, use the `heroui-react` skill (`.agents/skills/heroui-react/`) to fetch current component docs/source rather than relying on prior knowledge — its `SKILL.md` explicitly documents the v2→v3 breaking changes and includes scripts (`get_component_docs.mjs`, `get_source.mjs`, `get_styles.mjs`, `get_theme.mjs`) for pulling authoritative component info.

**Don't redeclare `--background`/`--foreground` in `globals.css`.** HeroUI v3 already owns those exact CSS variable names (plus `--surface`, `--surface-foreground`, etc. — run `node .agents/skills/heroui-react/scripts/get_theme.mjs` for the full token list), switching their values via `[data-theme='dark']`, not `prefers-color-scheme`. The original create-next-app boilerplate redeclared `--background`/`--foreground` under `:root` and its own `@media (prefers-color-scheme: dark)` block — that shadowed only those two HeroUI tokens, so components inherited a dark `--foreground` while `--surface` (Card's background) stayed on its light value, making text nearly invisible on cards in dark mode. Since this app has no theme toggle and follows the OS preference, `globals.css` instead mirrors HeroUI's whole `[data-theme='dark']` token block behind `@media (prefers-color-scheme: dark) { :root { ... } }` — keep it in sync with `get_theme.mjs`'s output if HeroUI ships new tokens.

## API integration

`apps/web/.env.local` (gitignored; copy `.env.example`) sets `NEXT_PUBLIC_API_URL` (`http://localhost:3001` in dev — `apps/api` binds there, not `3000`, to avoid colliding with this app's own dev port; see `apps/api/CLAUDE.md`). `src/lib/api.ts` wraps `fetch` calls to the API: `registerUser()` posts to `/auth/register` and throws `ApiError` (status + parsed `message` array from Nest's `ValidationPipe`/`HttpException` JSON body) on a non-2xx response — reuse this pattern (parse `message` as `string | string[]`, wrap in `ApiError`) for future endpoints rather than inlining `fetch` + ad hoc error handling in components.

`src/app/register/page.tsx` (`/register`) and `src/app/login/page.tsx` (`/login`) are the reference examples of a form wired to the API — both live at the flat top level (not under an `/auth/*` prefix, even though the API groups the matching endpoints under `/auth`), and cross-link to each other ("Уже есть аккаунт? Войти" / "Нет аккаунта? Зарегистрироваться") so keep both flat if a third auth page is added. Each is a client component using HeroUI's `Form` + `TextField`/`Input`/`FieldError` compound components, mapping `ApiError.messages` to per-field errors via `Form`'s `validationErrors` prop (falls back to a general error message if a server message doesn't match `email`/`пароль` by keyword — the keyword is Russian for the password field since messages are Russian, see "UI language" below). On success both store `accessToken` in `localStorage` and redirect with `next/navigation`'s `useRouter`. Follow this shape (client component + `lib/api.ts` helper + `validationErrors` mapping) for other auth-gated forms rather than introducing a form library.

Set `validationBehavior="aria"` on `Form` for any new form, not the (React Aria) default `"native"`: `"native"` surfaces the browser's own constraint-validation messages (localized to the visitor's OS/browser language, not this app's), and blocks submission with a native popup instead of `FieldError`. `"aria"` lets each `TextField`'s own `validate` function supply the message text (see `register/page.tsx`'s email/password `validate` props for the pattern) and still auto-focuses the first invalid field on submit.

`src/lib/api.ts` also exports `loginUser()` (posts `/auth/login`, same `ApiError` shape as `registerUser`) and `getMeetings(accessToken)` (`GET /meetings` with a `Bearer` header, JWT-guarded on the API side). `src/lib/auth.ts`'s `decodeAccessToken(token)` decodes the JWT payload (`{ sub, email, exp }`) client-side — there's no `/auth/me` endpoint, and the payload already carries `email` (see `apps/api/src/auth/token.service.ts`), so this avoids an extra round-trip.

`src/app/page.tsx` (`/`) is the first auth-gated page: a client component that, in a `useEffect`, reads `accessToken` from `localStorage`, decodes it, and `router.replace('/login')` if missing/invalid, otherwise fetches meetings and renders a greeting/count/last-3-meetings list. Two gotchas hit while building it, worth knowing before touching this page or adding another auth-gated one:

- **Don't derive the redirect/email decision from `useSyncExternalStore` reading `localStorage`.** On a full page load (not a client-side transition), Next SSRs this "use client" page; `useSyncExternalStore`'s SSR-consistency mechanism renders once with the server snapshot (`null`) and corrects to the real client value in a second pass — but a `useEffect` that fires `router.replace('/login')` on that first `null` pass can win the navigation race even though the corrected pass would have found a valid token, causing a spurious bounce back to the login page after a successful login. Plain `useState` + `useEffect` (which never executes during SSR at all) sidesteps this; that's why `page.tsx` uses that instead, despite the extra lint step below.
- **`setState` called synchronously (not inside a `.then`/`.catch`) at the top of a `useEffect` body trips `react-hooks/set-state-in-effect`.** For a value that's only knowable client-side (`localStorage`) and needed to gate the very first render, there's no way to compute it during render/SSR, so the effect is genuinely required — suppress the specific line with `// eslint-disable-next-line react-hooks/set-state-in-effect` and a comment explaining why, rather than restructuring around the lint (see `page.tsx`'s `setEmail` call for the pattern).

**HeroUI `Link`'s `render` prop for Next.js `<Link>` doesn't typecheck** — `Link`'s default element type is `span`, so `render={(props) => <NextLink {...props} .../>}` fails with a `ref` type mismatch (`RefObject<HTMLSpanElement>` not assignable to `RefObject<HTMLAnchorElement>`). Use the documented `linkVariants()` slots pattern instead: `import { linkVariants } from '@heroui/styles'`, then `<NextLink className={linkVariants().base()} href="...">` (see `login/page.tsx`'s "Зарегистрироваться" link). Same applies to `Button`'s `render` prop when wrapping a `NextLink` — prefer `isDisabled` over routing to a not-yet-built destination (see `page.tsx`'s "Создать встречу" button) rather than fighting the render-prop typing for a placeholder link.

## UI language

All user-facing text — labels, placeholders, button text, client-side `validate` messages, `aria-label`s — is Russian (`apps/web/src/app/layout.tsx` sets `lang="ru"`, and the Geist font subsets include `cyrillic` for this reason; don't drop that subset). Server-side validation messages must match: see `apps/api/CLAUDE.md`'s note that `class-validator` decorators and thrown exceptions need an explicit Russian `message`, since `ApiError.messages` renders straight into this UI — an English default (e.g. class-validator's un-overridden `email must be an email`) would show up mixed in next to Russian labels.

## Verifying frontend changes

A frontend change is not done until both of these have run, not just typecheck/lint/tests:

1. **Visually test it in a real browser via the `playwright` MCP server** (`.mcp.json`, see root `CLAUDE.md`) — navigate to the affected page(s), exercise the actual change (not just the happy path: empty/invalid submits, error states, loading states), and check both light and dark mode (`page.emulateMedia({ colorScheme: ... })`) since HeroUI's dark tokens only kick in under `prefers-color-scheme` here (see the HeroUI v3 note above) and light-mode-only testing has silently missed contrast regressions before.
2. **Run the change past the `ui-ux-pro-max` skill** — at minimum `--domain ux` for the relevant area (forms, accessibility, navigation, etc.) and, for HeroUI-specific questions, cross-check against `heroui-react`'s `get_theme.mjs`/`get_component_docs.mjs`. Treat High/Critical-severity findings as required fixes, not suggestions.

Report what you actually observed (screenshots/contrast numbers/console output), not just "typecheck passes" — a passing build does not mean the UI renders or reads correctly.

## Turbopack root

`next.config.ts` sets `turbopack.root` to the monorepo root (two levels up), not to `apps/web`. This is required because dependencies are hoisted to the root `node_modules` by npm workspaces; scoping the Turbopack root to this app directory breaks module resolution (e.g. `react/jsx-runtime` fails to resolve).

## Formatting

`.prettierrc` here mirrors `apps/api`'s (`singleQuote`, `trailingComma: "all"`, `tabWidth: 4`) — keep them in sync. ESLint here (`eslint-config-next`) carries no stylistic rules, so `eslint --fix` alone does not reformat code; Prettier is what actually formats. A repo-wide Claude Code hook (see root `CLAUDE.md`) runs this automatically after edits — you shouldn't need to run `npm run format` manually in normal use.

## Keeping documentation current

Update this file whenever a change affects what it describes (stack, scripts, HeroUI conventions, config quirks) — in the same change, not as a follow-up. See the root `CLAUDE.md` for the repo-wide policy.
