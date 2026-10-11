# Meridian Commerce OS

A premium, production-quality commerce application with two interconnected
experiences:

- **Meridian Store** — a customer-facing storefront (`/`).
- **Meridian Studio** — a merchant operations workspace (`/studio`).

Remote data is provided by [DummyJSON](https://dummyjson.com/docs). Any data the
application creates or edits (cart, wishlist, local product overrides, demo
orders, merchandising, preferences) is persisted **client-side** and clearly
distinguished from the remote sample data.

> This is a demonstration application. DummyJSON mutations are simulated and are
> never treated as durable server-side changes; checkout is simulated and no real
> payment is collected.

## Stack

- Next.js 16 (App Router, Turbopack, Cache Components) + React 19
- TypeScript (strict)
- Tailwind CSS v4 + shadcn/ui primitives (Base UI)
- TanStack Query (remote data), Zustand (client state), React Hook Form + Zod
- Recharts (charts), Lucide (icons)
- Vitest + React Testing Library (unit/component); Playwright (e2e)

## Getting started

```bash
npm install
npm run dev      # http://localhost:3000
```

## Scripts

| Command             | Description                                  |
| ------------------- | -------------------------------------------- |
| `npm run dev`       | Start the dev server.                        |
| `npm run build`     | Production build.                            |
| `npm run start`     | Serve the production build.                  |
| `npm run lint`      | ESLint.                                      |
| `npm run typecheck` | `tsc --noEmit`.                              |
| `npm test`          | Vitest (unit + component).                   |
| `npm run test:e2e`  | Playwright (install browsers first).         |

For e2e the first time:

```bash
npx playwright install chromium
npm run test:e2e
```

## Project structure

```
app/                 routes, layouts, page composition
components/          shared interface components
  ui/                reusable primitives (shadcn/ui)
features/            storefront/ and merchant/ feature modules
lib/
  api/               DummyJSON clients, queries, response validation
  domain/            pricing, cart, inventory, order calculations
  state/             persistent client-side state (Zustand)
  validation/        reusable Zod schemas
  utils/             shared utilities
tests/               unit, integration, and e2e tests
```

## Notes on the environment

This project uses **Next.js 16**, which differs from earlier versions. Before
writing framework code, read the bundled docs at `node_modules/next/dist/docs/`
(see `AGENTS.md`). Cache Components (`cacheComponents`) and partial prefetching
are enabled.
