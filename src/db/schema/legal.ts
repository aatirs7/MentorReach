import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { users } from './users'

/**
 * Proof of what each person agreed to, and when.
 *
 * APPEND-ONLY. Nothing here is ever updated or deleted, including on re-acceptance after
 * a version bump — that writes a NEW row. The table is the evidence trail, and an evidence
 * trail you can edit is not one.
 *
 * `content_hash` is why a version string alone isn't enough. A version records WHICH
 * document; the hash records WHAT IT SAID. Without it, editing a markdown file without
 * touching its frontmatter would silently repoint every prior signature at text nobody
 * ever saw, and nothing in the system could detect it. `src/lib/legal.test.ts` locks each
 * document's hash to its version so that can't happen unnoticed.
 *
 * `ip_address` and `user_agent` are captured because an electronic signature's weight in
 * a dispute comes from the circumstances recorded around it, not from the typed name.
 */
export const legalAcceptances = pgTable(
  'legal_acceptances',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** A LegalKey — 'terms' | 'privacy' | 'refunds' | 'mentor_agreement' | 'mentor_handbook'. */
    documentKey: text('document_key').notNull(),
    documentVersion: text('document_version').notNull(),
    contentHash: text('content_hash').notNull(),

    /** Typed full legal name. Null for checkbox acceptances, required for signatures. */
    signatureName: text('signature_name'),
    /** 'checkbox' | 'typed_signature' */
    method: text('method').notNull(),

    acceptedAt: timestamp('accepted_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
  },
  /**
   * Indexed by (user, document) because every read is "has this person accepted this
   * document, and at which version" — the publish gate asks it on every profile render.
   * Deliberately NOT unique: re-acceptance after a version bump must be able to insert.
   */
  (t) => [index('legal_acceptances_user_document_idx').on(t.userId, t.documentKey)],
)
