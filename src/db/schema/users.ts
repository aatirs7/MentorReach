import { relations } from 'drizzle-orm'
import { type AnyPgColumn, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { userRole } from './enums'

/**
 * Spec §3/§4.
 *
 * CONVENTION (applies to every table in this schema): all `mentor_id` / `student_id`
 * columns anywhere reference `users.id`, NEVER `mentor_profiles.id`. Uniform FK target;
 * session history survives a profile being rebuilt. Join to mentor_profiles via
 * `mentor_profiles.user_id`.
 *
 * Clerk is the source of truth for identity and role. This table is a one-way MIRROR
 * (Clerk → Neon) so we can JOIN/WHERE on role without an API call. Never write a role
 * here without writing Clerk first; on disagreement, Clerk wins.
 */
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    /**
     * The join key to Clerk. The UNIQUE constraint is load-bearing: it makes the
     * webhook and the lazy `ensureUser()` upsert commutative, so whichever arrives
     * first wins and the other becomes a no-op. Without it they race.
     */
    clerkId: text('clerk_id').notNull().unique(),

    role: userRole('role').notNull(),

    /**
     * Indexed but deliberately NOT unique — Clerk permits multiple emails per user
     * and this is a denormalized copy of the primary. A unique constraint here would
     * eventually break a webhook write for no benefit.
     */
    email: text('email').notNull(),

    /** Nullable: OAuth providers don't always supply a name. */
    fullName: text('full_name'),

    /**
     * Spec §6. Not in the spec's §4 table list, but §6's binding logic requires it.
     * Captured at signup from a referral code; immutable afterwards (enforced in the
     * app layer — Postgres has no cheap "immutable after insert" for a nullable col).
     */
    referredByMentorId: uuid('referred_by_mentor_id').references((): AnyPgColumn => users.id, {
      onDelete: 'set null',
    }),

    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index('users_email_idx').on(t.email), index('users_referred_by_idx').on(t.referredByMentorId)],
)

export const usersRelations = relations(users, ({ one }) => ({
  referredByMentor: one(users, {
    fields: [users.referredByMentorId],
    references: [users.id],
    relationName: 'referred_by_mentor',
  }),
}))
