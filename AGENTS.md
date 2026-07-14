<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Trajectory Coaching

A Preply-style two-sided coaching marketplace. **The source of truth is
[`docs/trajectory-platform-spec.md`](docs/trajectory-platform-spec.md)** — read it before
making product decisions. Section references below (§4, §6, …) point into it.

Motto: "Own your trajectory."

## Hard rules (spec §2) — enforce in logic, not just docs

1. **All payment happens on-platform.** No off-platform arrangements at any commission
   tier. Calendly handles time selection only; money always flows through Stripe Connect.
2. **Commission attribution is frozen and dumb by design.** Set once per (coach, student)
   pair at first transaction, never re-evaluated, no manual overrides, no case-by-case.
   Enforced by `UNIQUE(coach_id, student_id)` on `coach_student_links` — there is
   physically nowhere to put a second commission value for a pair. All attribution logic
   lives in `src/lib/commission.ts` and nowhere else.
3. **Students are gated behind the survey.** No browsing or booking until
   `student_surveys.completed_at IS NOT NULL`.
4. **Coaches are gated behind approval.** New profiles are `pending` (a DB default, not an
   app decision) and invisible/unbookable until an admin approves.

## Stack

Next.js 16 (App Router) · Neon Postgres · Drizzle · Clerk · Stripe Connect · Calendly ·
Resend · Vercel · Tailwind 4 + shadcn/ui.

## Conventions that will bite you if you don't know them

- **`src/proxy.ts`, not `middleware.ts`.** Next 16 renamed the convention. The proxy only
  attaches Clerk's auth context; it does no route protection. Gate at the resource with
  `requireRole()`. `createRouteMatcher()` is deprecated — don't reintroduce it.
- **`ClerkProvider` goes inside `<body>`.** Clerk Core 3 changed this.
- **`auth()` and `clerkClient()` are async.** Await them.
- **Clerk is the source of truth for identity/role; Neon's `users.role` is a one-way
  mirror** so we can JOIN/WHERE without an API call. Never write a role to Neon without
  writing Clerk first. Two paths keep it fresh — the webhook
  (`src/app/api/webhooks/clerk/route.ts`) and `ensureUser()` — made commutative by
  `UNIQUE(clerk_id)`. Read the comments in `src/lib/auth/ensure-user.ts` before touching
  either.
- **There is no `tailwind.config.ts`.** Tailwind 4 is CSS-first; the theme lives in
  `src/app/globals.css`.
- **Brand hexes are declared once**, in `:root` in `globals.css`, and every shadcn
  semantic token aliases them. Never hardcode a brand hex anywhere else. If a component
  needs to look on-brand, it should already.
- **All `coach_id` / `student_id` columns reference `users.id`**, never
  `coach_profiles.id`. Join to profiles via `coach_profiles.user_id`.
- **Money is integer cents.** Never float, never `numeric`. `splitAmount()` derives payout
  as `amount − commission`; don't "fix" it into two independent roundings or the
  `sessions_amount_split_balances` CHECK will eventually fire on a rounding cent.
- **The DB driver is `neon-http`, which has no interactive transactions.** Use
  `db.batch()`. See the comment in `src/db/index.ts` before reaching for
  `db.transaction()`.

## Commands

```bash
npm run dev          # Next dev server
npm run typecheck    # tsc --noEmit
npm run lint
npm test             # commission unit tests
npm run db:generate  # emit SQL from schema — review the file it writes
npm run db:migrate   # apply to Neon (uses the UNPOOLED url)
npm run db:studio
```

Migrations are `generate` + `migrate`, run manually, with `drizzle/` committed. They do
**not** run in the Vercel build — concurrent preview builds would race DDL against one
database. `db:push` is for local scratch against a Neon branch only.

## Unresolved with the client

Spec §14 plus six schema-shaped questions are open — see `docs/trajectory-platform-spec.md`
§14 and the comments in `src/db/schema/`. Notably: the §6 commission binding
interpretation is an assumption, which is why that logic is quarantined in one pure
function.
