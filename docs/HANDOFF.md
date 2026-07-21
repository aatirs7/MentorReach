# MentorReach — handoff

**The living state of the system.** What exists, what is switched on, what is not, and what
is still undecided.

> **Update this at the end of a working session, before you stop** — one pass covering
> everything that changed, not a running commentary. If you shipped a feature, flipped an
> integration on, made an architectural decision, or hit a trap worth remembering, it
> belongs here before the session ends. A handoff doc that lags the code is worse than
> none, because it is trusted.

- **Architecture and conventions:** [`../AGENTS.md`](../AGENTS.md) — read that first
- **Product spec (source of truth for product decisions):** [`mentorreach-platform-spec.md`](mentorreach-platform-spec.md)
- **Where the build deviates from the spec, and why:** [`spec-coverage.md`](spec-coverage.md)

Last updated: **2026-07-21**

## Terminology: mentor, not coach

The product calls them **mentors**, everywhere: UI copy, routes (`/mentors`, `/mentor/*`),
emails, and the database (`mentor_profiles`, `mentor_id`, `user_role = 'mentor'`). The
legal documents define "Mentor" as the contracting party, so a split would have been a gap
a dispute could find.

The rename went all the way down on purpose. It was done while there were **zero real
mentors, students or sessions** — the cheapest it would ever be — because a half-rename,
where the UI says mentor and the schema says coach, is how a codebase becomes permanently
confusing.

`/coaches` and `/coach/*` **308-redirect** to their new paths, preserving the rest of the
path (`/coaches/<id>` → `/mentors/<id>`). Those redirects are load-bearing: `/coaches` was
one of three URLs submitted to Google Search Console and was being crawled when the rename
landed. Do not remove them.

Migrations `0013` and `0014` are hand-written `ALTER ... RENAME` statements. drizzle-kit
cannot tell a rename from a drop-and-create without an interactive prompt, and its
generated version would have destroyed every row.

---

## Where it runs

| | |
|---|---|
| Production | https://mentorreach.com |
| Repo | github.com/aatirs7/trajectorycoaching (deploys from `main`) |
| Vercel project | `trajectorycoaching` under `aatir-siddiquis-projects` |
| Database | Neon Postgres (`ep-summer-boat`), 13 migrations applied |
| DNS | Vercel nameservers (`ns1/ns2.vercel-dns.com`) |

Deploys are automatic from `main`. **Environment variable changes need a redeploy** —
`NEXT_PUBLIC_*` values are inlined at build time, so editing them in Vercel does nothing
until the next build.

---

## Integration status

`/admin/integrations` is the authoritative live check. This table is the summary.

| Integration | Status | Notes |
|---|---|---|
| Neon Postgres | **Live** | Required; app will not boot without it |
| Clerk | **Live (production instance)** | Google sign-in, claims editor, webhook all configured |
| Resend | **Live** | `mentorreach.com` verified; sends from `hello@mentorreach.com` |
| Vercel Blob | **Live** | Mentor headshot uploads |
| Stripe Connect | **Not configured** | No keys yet. Blocks all payment and booking |
| Zoom | **Not configured** | No Server-to-Server OAuth app yet. Blocks booking |
| Cron | **Live** | `CRON_SECRET` set; `vercel.json` runs `/api/cron` hourly |

**Booking is off.** `bookingEnabled()` is `stripe && zoom` and neither is configured, so the
Book button is disabled with an honest reason rather than failing at checkout.

### Clerk specifics that are easy to get wrong

- The **claims editor** (Sessions → Customize session token → `{ "metadata": "{{user.public_metadata}}" }`)
  is not code and does not carry over between instances. Without it `sessionClaims.metadata.role`
  is `undefined` and every gated page silently redirects to `/` — for everyone, including admins.
- **Live keys must never be in `.env.local`.** A `pk_live_` encodes its domain
  (`clerk.mentorreach.com`) and rejects `localhost`, and a duplicate key later in a `.env`
  file overrides the earlier one — so a live pair pasted at the bottom silently disables the
  test pair above it. `src/lib/env.ts` now throws in development if it finds one.
- The production instance has **its own users**. Development accounts do not exist there.
- Admin is granted out of band: `npx tsx scripts/make-admin.ts you@example.com`, then
  **sign out and back in** (the session token only reissues on refresh).

---

## What is built

### Marketplace
- Public browse (`/mentors`) and mentor profiles (`/mentors/[id]`), both indexable
- Mentor application (`/mentors/apply`) → admin review at `/ops/applications`
- Invite-based mentor onboarding (`/join/[token]`) with self-serve setup
- Mentors self-publish: no approval gate, checklist computed in `src/lib/mentor-publish.ts`
- Student survey gate — enforced at **booking**, not browsing

### Scheduling (native — Calendly was removed)
- Mentors declare weekly availability + blackout dates (`mentor_availability_rules`,
  `mentor_availability_blackouts`)
- `src/lib/scheduler.ts` generates bookable slots — pure and unit-tested, including a DST
  boundary case
- Booking is **pick a time → then pay**: a `session_holds` row reserves the slot for the
  30-minute Stripe checkout window
- Zoom meeting created per booking from one platform account, so mentors need no Zoom setup

### Money
- Stripe Connect destination charges: `application_fee_amount` is commission,
  `transfer_data.destination` is the mentor's Express account
- Commission frozen per (mentor, student) pair at first transaction — `UNIQUE(mentor_id, student_id)`
- Integer cents everywhere; `splitAmount()` derives payout as `amount − commission`
- 24-hour cancellation policy; **we** decide refunds, not any external tool

### Internal
- `/ops` — shared founder task board, two-level hierarchy (workstream → sub-task)
- `/ops/overview` — per-founder dashboard: progress, completion timeline, open work.
  Click a founder to filter (`?who=Aatir`)
- `/admin/*` — mentors, students, accounts, reports, integrations
- Admin "view as mentor" — read-only preview via an httpOnly cookie, honored only for admins

### SEO
- `robots.txt` and a dynamic `sitemap.xml`, submitted and accepted in Google Search Console
- Open Graph + Twitter cards; generated share images, including a per-mentor card
- Structured data: Organization, WebSite, Person, Service, Offer, Breadcrumbs, FAQ
- 28 private routes marked `noindex`

**Seed mentors are excluded from all of it** — no sitemap entry, `noindex`, and no `Person`
structured data. Every mentor currently on the site is invented and carries a real employer's
name, so indexing them would ask Google to catalogue fabricated professionals under this
domain. `liveMentorSql()` still treats them as live, because "visible to a person" and "safe
to hand a crawler" are different questions.

---

## Known gaps and things that will bite

**The homepage claims mentors that do not exist.** The "Hand-picked mentors from Figma,
Evercore, SpaceX…" strip is derived from the live roster so it can never go stale — but the
roster is 6 seed profiles and **0 real mentors**. It is a false claim to human visitors, and
`noindex` does nothing about it. Either clear the seed data or hide the strip before any
real traffic arrives.

**Every public page renders per request.** `SiteHeader` calls Clerk's `auth()`, which reads
cookies and opts every route out of static rendering — homepage and mentor profiles included.
Not an indexing blocker, but TTFB is on the critical path.

**Industry landing pages are the next SEO lever, and must wait.** Built against 6 seed
mentors they would be thin auto-generated category pages, which is the doorway-page pattern
Google devalues. Onboard real mentors first.

**Isaiah has no account.** He cannot see `/ops`, and task completions cannot be credited to
him, until he signs up on production and is promoted.

**The Clerk sign-in card still reads "Trajectory Coaching."** That is the Clerk
*application name*, set per-instance in the dashboard, not in code — nothing in this repo
can fix it. It is the first thing a prospective mentor sees when signing up, and the nine
founding mentors have never seen the old brand. Change it on the production instance
before they are invited.

Note the repo and Vercel project are also still named `trajectorycoaching`. Those are
external identifiers, deliberately left alone: renaming the repo rewrites the git remote
and the Vercel project for no user-visible gain.

**Legal documents are drafts with unresolved placeholders.** `[LEGAL ENTITY NAME]`,
`[STATE]`, `[SUPPORT EMAIL]`, `[MAILING ADDRESS]`, the arbitration choice in the Terms and
the non-circumvention period in the Mentor Agreement all still need filling, and all five
need an attorney's review before anyone signs. A dev-only banner lists the unresolved
placeholders on each `/legal/*` page; it never renders in production.

**Editing a legal document requires a version bump.** `src/lib/legal.test.ts` locks each
document's SHA-256 to its version and fails if the text changes without one. The procedure:
copy the current file to `src/content/legal/archive/<key>/<old-version>.md`, bump `version`
in frontmatter, then update both the version and the hash in the lock table. Do not simply
paste in the new hash — a signature records a version AND a hash, so changing text under a
fixed version leaves every prior acceptance pointing at words nobody agreed to.

---

## Open product decisions

Tracked in spec §14; these are the load-bearing ones.

- **§14.1 commission binding** — the per-pair reading is an assumption, quarantined in
  `src/lib/commission.ts` so a different answer is a one-file change plus a test update
- **§14.2 late cancel** — we assume the mentor keeps the payout; changing it is the
  `if (refundable)` branch in `src/lib/cancel.ts`
- **§7 Q7 `path_certainty`** — stored 1–5, labels need confirming
- **Zoom host model** — the platform account hosts; mentors get the `start_url`. Per-mentor
  Zoom accounts would be a `zoom.ts` change plus a `zoom_user_id` column

---

## Next steps, in order

1. **Stripe** — enable Connect, add keys, webhook at `/api/webhooks/stripe` for
   `checkout.session.completed`, `charge.refunded`, `account.updated`
2. **Zoom** — Server-to-Server OAuth app, all three credentials (booking needs Stripe *and* Zoom)
3. **Onboard the 9 founding mentors** — unblocks everything below
4. **Clear or hide the seed roster** once real mentors publish
5. **Industry landing pages**, once there are real people behind them
