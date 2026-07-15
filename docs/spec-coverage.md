# Spec coverage — where each requirement lives

Maps `trajectory-platform-spec.md` to the code, so this can be audited rather than taken
on trust. Sections refer to the spec.

## §2 Hard rules — enforced in logic, not docs

| Rule | Where it's enforced |
|---|---|
| §2.1 All payment on-platform | Only path to a session is Stripe Checkout (`lib/booking.ts`). `sessions` can only be created by the `checkout.session.completed` webhook. "Asked to pay off-platform" is a first-class report category (`app/report/actions.ts`). |
| §2.2 Commission frozen, no overrides | `UNIQUE(coach_id, student_id)` on `coach_student_links` — there is physically nowhere to put a second rate for a pair. `getOrCreateLink()` reads before it ever computes. All logic in `lib/commission.ts`, pure, no I/O. |
| §2.3 Students gated behind survey | `requireStudent()` in `lib/auth/guards.ts`, gating on `completed_at IS NOT NULL` (not row existence). Applied on every browse/book surface **and** inside the booking server action. |
| §2.4 Coaches gated behind approval | `coach_profiles.status` **DEFAULT 'pending'** (a DB default, not an app decision). `browseCoaches()`/`getPublicCoach()` only ever return `approved`. Re-checked at the money path in `createCheckout()`. |

## §3–§12

| Spec | Implementation |
|---|---|
| §3 Roles & onboarding | `app/onboarding/role`, `lib/auth/set-role.ts` (server action → Clerk `publicMetadata`; `admin` not self-assignable). Guards in `lib/auth/guards.ts`. |
| §4 Data model | `src/db/schema/*`. Deviations documented inline — see "Schema deviations" below. |
| §5 Coach profile | `app/coach/setup`, `lib/coach-schema.ts`. Referral code auto-generated (`lib/auth/referral.ts`). |
| §6 Commission & referral | `lib/commission.ts` (pure + tested), `lib/booking.ts#getOrCreateLink`, `app/r/[code]/route.ts`, `lib/auth/referral.ts`. |
| §7 Student survey | `app/onboarding/survey`, `lib/survey-schema.ts` — discriminated union on `education_level` makes Q2's conditional options enforceable server-side. |
| §8 Browse & book | `lib/browse.ts`, `app/coaches`, `app/coaches/[id]`, `lib/booking.ts`, `app/book/complete`. |
| §9 Calendly | `lib/calendly.ts`, `app/api/webhooks/calendly/route.ts`. Correlation is `utm_content=<session_id>` echoed back under `tracking`. |
| §10 Stripe Connect | `lib/stripe.ts`, `lib/booking.ts`, `app/api/webhooks/stripe/route.ts`, `app/coach/payouts`. Destination charge: `application_fee_amount` + `transfer_data.destination`. |
| §11 State machine & policy | `lib/sessions.ts` (pure, tested), `lib/cancel.ts`, `app/api/cron/route.ts`. |
| §12 Dashboards, notes, notifications, trust & safety | `app/sessions`, `app/notifications`, `app/report`, `app/admin/*`, `lib/notifications.ts`, `lib/email/*`. |

## Deliberate deviations, and why

- **`coach_profiles.current_role` → `current_title`** — `CURRENT_ROLE` is a reserved
  Postgres keyword, and `users.role` already means something entirely different.
- **Added `users.referred_by_coach_id`** — §6 requires it; §4 omits it.
- **Added `coach_offerings.is_active`** — `sessions.offering_id` references offerings with
  `onDelete: 'restrict'`, so a hard delete would orphan session history.
- **Added `sessions.link_id`** — makes commission provenance a join rather than an
  archaeology exercise. Supports the §2.2 audit story.
- **Added `student_surveys.help_with_other`** — §7 Q9 offers "Other (+text)" with no column
  in §4.
- **Added `sessions.reminder_sent_at`** — a time window is not an idempotency key; an
  hourly reminder job would otherwise re-send every tick.
- **Added `coach_profiles.calendly_scheduling_url`** — the API URI can't be iframed and the
  public slug can't be derived from it, so the §8 embed needs its own value.
- **`subscriptions` deferred** — §4 lists it under Phase 1.5; its shape depends on the
  undecided credits-ledger design.
- **`refunded` vs `canceled_free` built as sequential, not alternative** — §10 and §11 read
  contradictorily. `canceled_free` = intent at cancel time; `refunded` = fact once
  `charge.refunded` confirms. Refunds are async and need a state for the gap.

## Known limitations

- **Calendly event types are created by the coach, not by us.** §9 says "their event types
  created". Calendly has since added a Create Event Type endpoint, but its exact request
  shape couldn't be verified against live docs, and a wrong body would fail at runtime
  while looking like a working feature — on the path that decides whether a paid student
  can book. The lookup (`findEventTypeByDuration`) handles coach-created types and fails
  loudly. See the note in `lib/calendly.ts`.
- **Headshots are URLs, not uploads.** `<img>` with an arbitrary host, so `next/image` is
  bypassed. Revisit when images are hosted by us.
- **Stripe Checkout is hosted (redirect), not embedded.** §2.1 means "no off-platform
  arrangements" — money still flows through Stripe Connect with our application fee. An
  embedded Payment Element would give more brand control at the cost of owning the
  PaymentIntent lifecycle.

## Not built (explicitly out of scope per §13)

- **Phase 1.5** — subscriptions/credits, in-app messaging. (Reminders, listed under 1.5,
  ARE built, since §12 requires the notification.)
- **Phase 2** — public reviews/ratings, real-time availability filter in browse, annual
  coach membership fee, native in-platform video.

## Open questions that change code

| Question | The one place to change |
|---|---|
| §14.1 commission binding | `lib/commission.ts#resolveCommission` + its tests |
| §14.2 late cancel / no-show payout | the `if (refundable)` branch in `lib/cancel.ts` |
| §14.3 Calendly org model | `lib/calendly.ts` |
| §14.4 coach Stripe onboarding | `app/coach/payouts` builds the self-serve path, which an admin can also walk a coach through — a superset of either answer |
| §14.5 domain | blocks promoting Clerk to a production instance; dev keys until then |
| §7 Q7 `path_certainty` labels | `lib/survey-schema.ts#PATH_CERTAINTY_LABELS` |
