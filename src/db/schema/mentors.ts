import { relations, sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'
import { mentorStatus } from './enums'
import { users } from './users'

/** Spec §5. */
export const mentorProfiles = pgTable(
  'mentor_profiles',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    userId: uuid('user_id')
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** Open set — `text`, not an enum. New industries must not require a migration. */
    industry: text('industry').notNull(),

    /**
     * Spec §4 calls this `current_role`. RENAMED: CURRENT_ROLE is a reserved keyword
     * in Postgres — Drizzle quotes identifiers so it would work, but every hand-written
     * psql query becomes a quoting trap. It also disambiguates from `users.role`, which
     * is a genuinely different concept (job title vs. auth role).
     */
    currentTitle: text('current_title').notNull(),

    bio: text('bio').notNull(),
    headshotUrl: text('headshot_url'),

    /**
     * Optional resume/CV (PDF), uploaded during onboarding via Vercel Blob. Admin-only:
     * shown on the mentor detail page for context, never on the public profile. Not part of
     * the publish checklist — mentors go live without it.
     */
    resumeUrl: text('resume_url'),

    /**
     * Employer visibility (from the mentor application §6). When true, the public card and
     * profile show `general_title` ("Finance Professional") instead of `current_title`,
     * for mentors whose employer doesn't allow the firm name to be shown.
     */
    displayEmployerGenerally: boolean('display_employer_generally').notNull().default(false),
    generalTitle: text('general_title'),

    /**
     * Up to a few short tags rendered on the mentor card ("SA recruiting", "System
     * design"). jsonb rather than a join table: they're display-only, never queried or
     * filtered on, and a table would buy nothing but joins.
     */
    specialties: text('specialties').array().notNull().default([]),

    /**
     * TRUE only for demo rows created by scripts/seed-demo.ts.
     *
     * This exists to make one rule enforceable in DATA rather than by discipline:
     * placeholder faces are for seed mentors only. A real profile must never render a
     * generated/placeholder face — we tell students a session is a real conversation with
     * a real person, and a stock face would make that false at the most visible point on
     * the page. It's also what lets seed mentors stay live in browse without completing
     * the real-mentor publish checklist (see src/lib/mentor-publish.ts).
     *
     * DEFAULT false, so a real mentor cannot become seed by omission. See
     * resolveHeadshot() in src/lib/headshot.ts, the render-time enforcement point.
     */
    isSeed: boolean('is_seed').notNull().default(false),

    /** Optional. Useful context, not a verification gate — we no longer claim to verify. */
    linkedinUrl: text('linkedin_url'),

    employerNote: text('employer_note'),

    /**
     * Spec §6. Auto-generated. Normalized to uppercase on write and looked up on
     * uppercase — avoids needing the citext extension for case-insensitive matching.
     */
    referralCode: text('referral_code').notNull().unique(),

    /**
     * Native scheduler settings.
     *
     * `timezone` is the IANA zone the mentor declares their weekly availability in (e.g.
     * "America/New_York"); slot generation converts those local hours to UTC instants.
     * The guardrails bound what students can book:
     *   bookingBufferMinutes — enforced gap on both sides of each session
     *   minNoticeHours       — no bookings starting sooner than now + this many hours
     *   maxBookingsPerDay     — optional cap on sessions per local day (null = no cap)
     */
    timezone: text('timezone').notNull().default('America/New_York'),
    bookingBufferMinutes: smallint('booking_buffer_minutes').notNull().default(0),
    minNoticeHours: smallint('min_notice_hours').notNull().default(12),
    maxBookingsPerDay: smallint('max_bookings_per_day'),

    /** Spec §10 — Stripe Connect Express account. Nullable until onboarding starts. */
    stripeAccountId: text('stripe_account_id'),

    /**
     * Whether Stripe says this mentor can actually be paid (charges_enabled &&
     * payouts_enabled). Mirrored from Stripe by the account.updated webhook and by the
     * payouts page, so the "is this mentor live?" check stays a pure DB read — we can't
     * call the Stripe API once per mentor inside a browse query.
     */
    stripePayoutsEnabled: boolean('stripe_payouts_enabled').notNull().default(false),

    /**
     * The mentor's signed agreement to the Mentor Handbook (/mentor/handbook), captured at
     * onboarding and reviewable in admin. Required before a real profile can publish.
     *
     *   handbookAckAt      when they signed (the consent timestamp; also the checklist gate)
     *   handbookSignedName the full legal name they typed as their signature
     *   handbookVersion    which handbook version they agreed to (AGREEMENT_VERSION)
     *
     * Same evidence pattern as sessions.policy_ack_at: proof the standards were shown and
     * agreed to, at the moment of consent. Nullable only because seed/admin rows skip it.
     */
    handbookAckAt: timestamp('handbook_ack_at', { withTimezone: true, mode: 'date' }),
    handbookSignedName: text('handbook_signed_name'),
    handbookVersion: text('handbook_version'),

    /**
     * status is now ONLY an admin kill switch: `suspended` takes a mentor offline; anything
     * else means "live if the publish checklist is complete" (src/lib/mentor-publish.ts).
     * The old pending → admin-approval gate is gone — a completed profile publishes
     * itself, no manual step. `pending`/`approved` are both treated as "not suspended";
     * the distinction is vestigial. DEFAULT stays `pending` so a new profile is never
     * born suspended.
     */
    status: mentorStatus('status').notNull().default('pending'),

    /**
     * When the mentor finished the guided onboarding flow (/mentor/onboarding) and saw the
     * resources tour. NULL means they haven't been through it yet, which is what sends a
     * new mentor into the wizard instead of the plain dashboard. Independent of publish
     * live-ness (src/lib/mentor-publish.ts) — a mentor can finish the tour before every
     * checklist item is green, and vice versa.
     */
    onboardingCompletedAt: timestamp('onboarding_completed_at', { withTimezone: true, mode: 'date' }),

    approvedAt: timestamp('approved_at', { withTimezone: true, mode: 'date' }),
    approvedBy: uuid('approved_by').references(() => users.id, { onDelete: 'set null' }),

    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index('mentor_profiles_status_idx').on(t.status), index('mentor_profiles_industry_idx').on(t.industry)],
)

/** Spec §5 — a mentor may offer multiple session lengths at different rates. */
export const mentorOfferings = pgTable(
  'mentor_offerings',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    /** → users.id (see the convention note in users.ts), not mentor_profiles.id. */
    mentorId: uuid('mentor_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** smallint + CHECK rather than an enum: this value gets arithmetic done to it. */
    lengthMinutes: smallint('length_minutes').notNull(),

    priceCents: integer('price_cents').notNull(),

    /**
     * Not in the spec. `sessions.offering_id` FKs here, so offerings can never be hard
     * deleted without orphaning session history. Soft-delete from day one.
     */
    isActive: boolean('is_active').notNull().default(true),

    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    /** A mentor cannot have two 30-minute offerings at different prices. */
    unique('mentor_offerings_mentor_length_unq').on(t.mentorId, t.lengthMinutes),
    check('mentor_offerings_length_allowed', sql`${t.lengthMinutes} IN (30, 45, 60)`),
    check('mentor_offerings_price_positive', sql`${t.priceCents} > 0`),
    index('mentor_offerings_mentor_idx').on(t.mentorId),
  ],
)

/**
 * Note: offerings hang off `users`, not `mentor_profiles` (see the FK convention in
 * users.ts), so there is deliberately no `mentorProfiles.offerings` relation here —
 * go `mentorProfiles.user → user.offerings` instead.
 */
export const mentorProfilesRelations = relations(mentorProfiles, ({ one }) => ({
  user: one(users, { fields: [mentorProfiles.userId], references: [users.id], relationName: 'mentor_profile_user' }),
  approver: one(users, { fields: [mentorProfiles.approvedBy], references: [users.id], relationName: 'mentor_approver' }),
}))

export const mentorOfferingsRelations = relations(mentorOfferings, ({ one }) => ({
  mentor: one(users, { fields: [mentorOfferings.mentorId], references: [users.id] }),
}))
