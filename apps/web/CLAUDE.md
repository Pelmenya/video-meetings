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

## Turbopack root

`next.config.ts` sets `turbopack.root` to the monorepo root (two levels up), not to `apps/web`. This is required because dependencies are hoisted to the root `node_modules` by npm workspaces; scoping the Turbopack root to this app directory breaks module resolution (e.g. `react/jsx-runtime` fails to resolve).

## Formatting

`.prettierrc` here mirrors `apps/api`'s (`singleQuote`, `trailingComma: "all"`, `tabWidth: 4`) — keep them in sync. ESLint here (`eslint-config-next`) carries no stylistic rules, so `eslint --fix` alone does not reformat code; Prettier is what actually formats. A repo-wide Claude Code hook (see root `CLAUDE.md`) runs this automatically after edits — you shouldn't need to run `npm run format` manually in normal use.

## Keeping documentation current

Update this file whenever a change affects what it describes (stack, scripts, HeroUI conventions, config quirks) — in the same change, not as a follow-up. See the root `CLAUDE.md` for the repo-wide policy.
