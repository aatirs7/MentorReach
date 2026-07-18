import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { users } from './users'

/**
 * Coach invites — the official way a pre-approved coach gets onto the platform.
 *
 * Two sources feed this table:
 *   1. A founder invites someone directly from /admin/coaches (a friend, or anyone we
 *      vetted off-platform) — no application row exists.
 *   2. An application is accepted in /ops/applications, which mints an invite for that
 *      email (prefilled from the application) instead of the old bare /sign-up link.
 *
 * The invite carries a unique `token`; the link is /join/<token>. Claiming it sets the
 * coach role (src/lib/auth/set-role.ts) and drops the person into /coach/onboarding.
 *
 * NOT a coach profile and NOT an account — an invitee has no `users` row until they sign
 * up and claim. `accepted_user_id` links to that row once they do.
 *
 * `status` is plain `text` (like coach_applications.status): internal state that may
 * churn, not worth a pg enum.
 */
export const coachInvites = pgTable(
  'coach_invites',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    /** Who the invite is for. Matched against users.email at claim time and by the
     *  setup/onboarding prefill lookup. Not unique — a revoked invite can be reissued. */
    email: text('email').notNull(),

    /** Optional, for the greeting and profile prefill. */
    fullName: text('full_name'),

    /** Urlsafe random secret. The whole security of the link is that this is unguessable. */
    token: text('token').notNull().unique(),

    /** Optional prefill for a direct (friend) invite with no application behind it. */
    prefillField: text('prefill_field'),
    prefillTitle: text('prefill_title'),

    /** Which founder created it. */
    invitedBy: uuid('invited_by').references(() => users.id, { onDelete: 'set null' }),

    /** pending | accepted | revoked */
    status: text('status').notNull().default('pending'),

    /** The account that claimed this invite, once claimed. */
    acceptedUserId: uuid('accepted_user_id').references(() => users.id, { onDelete: 'set null' }),

    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true, mode: 'date' }),
    /** Nullable = never expires. The app sets +30 days on create and honors it if present. */
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }),
  },
  (t) => [index('coach_invites_email_status_idx').on(t.email, t.status)],
)
