-- Rename coach -> mentor across the schema.
--
-- HAND-WRITTEN, not generated. drizzle-kit cannot distinguish a rename from a
-- drop-and-create without an interactive prompt, and the generated version would have
-- destroyed every row. These are ALTER ... RENAME statements: data, indexes and foreign
-- keys all survive.
--
-- Safe to run now precisely because there are zero real mentors, students or sessions.
-- Every day the split persisted would have added more code where the UI said mentor and
-- the schema said coach.
--
-- The target names below were taken from what src/db/schema/*.ts actually declares, not
-- from guesswork, so a later `drizzle-kit generate` sees no drift.

-- Tables ---------------------------------------------------------------------
ALTER TABLE "coach_profiles" RENAME TO "mentor_profiles";--> statement-breakpoint
ALTER TABLE "coach_offerings" RENAME TO "mentor_offerings";--> statement-breakpoint
ALTER TABLE "coach_student_links" RENAME TO "mentor_student_links";--> statement-breakpoint
ALTER TABLE "coach_invites" RENAME TO "mentor_invites";--> statement-breakpoint
ALTER TABLE "coach_applications" RENAME TO "mentor_applications";--> statement-breakpoint
ALTER TABLE "coach_availability_rules" RENAME TO "mentor_availability_rules";--> statement-breakpoint
ALTER TABLE "coach_availability_blackouts" RENAME TO "mentor_availability_blackouts";--> statement-breakpoint

-- Columns --------------------------------------------------------------------
ALTER TABLE "mentor_offerings" RENAME COLUMN "coach_id" TO "mentor_id";--> statement-breakpoint
ALTER TABLE "mentor_student_links" RENAME COLUMN "coach_id" TO "mentor_id";--> statement-breakpoint
ALTER TABLE "mentor_availability_rules" RENAME COLUMN "coach_id" TO "mentor_id";--> statement-breakpoint
ALTER TABLE "mentor_availability_blackouts" RENAME COLUMN "coach_id" TO "mentor_id";--> statement-breakpoint
ALTER TABLE "sessions" RENAME COLUMN "coach_id" TO "mentor_id";--> statement-breakpoint
ALTER TABLE "sessions" RENAME COLUMN "coach_payout_cents" TO "mentor_payout_cents";--> statement-breakpoint
ALTER TABLE "session_holds" RENAME COLUMN "coach_id" TO "mentor_id";--> statement-breakpoint
ALTER TABLE "session_notes" RENAME COLUMN "coach_id" TO "mentor_id";--> statement-breakpoint
ALTER TABLE "users" RENAME COLUMN "referred_by_coach_id" TO "referred_by_mentor_id";--> statement-breakpoint
-- Application free-text columns: "coaching types" is what a mentor offers, so it renames
-- with everything else rather than being left as the one survivor of the old vocabulary.
ALTER TABLE "mentor_applications" RENAME COLUMN "coaching_types" TO "mentoring_types";--> statement-breakpoint
ALTER TABLE "mentor_applications" RENAME COLUMN "coaching_other" TO "mentoring_other";--> statement-breakpoint

-- Enums ----------------------------------------------------------------------
-- RENAME VALUE rewrites the label in place: rows carrying 'coach' become 'mentor' with no
-- UPDATE and no window where the value is invalid.
ALTER TYPE "public"."user_role" RENAME VALUE 'coach' TO 'mentor';--> statement-breakpoint
ALTER TYPE "public"."coach_status" RENAME TO "mentor_status";--> statement-breakpoint

-- Indexes --------------------------------------------------------------------
-- Postgres does NOT rename indexes when their table is renamed, and Drizzle declares
-- these by name — so leaving them would make the next `generate` want to drop and
-- recreate each one.
ALTER INDEX IF EXISTS "coach_profiles_industry_idx" RENAME TO "mentor_profiles_industry_idx";--> statement-breakpoint
ALTER INDEX IF EXISTS "coach_profiles_status_idx" RENAME TO "mentor_profiles_status_idx";--> statement-breakpoint
ALTER INDEX IF EXISTS "coach_offerings_coach_idx" RENAME TO "mentor_offerings_mentor_idx";--> statement-breakpoint
ALTER INDEX IF EXISTS "coach_offerings_coach_length_unq" RENAME TO "mentor_offerings_mentor_length_unq";--> statement-breakpoint
ALTER INDEX IF EXISTS "coach_student_links_pair_unq" RENAME TO "mentor_student_links_pair_unq";--> statement-breakpoint
ALTER INDEX IF EXISTS "coach_student_links_student_idx" RENAME TO "mentor_student_links_student_idx";--> statement-breakpoint
ALTER INDEX IF EXISTS "coach_invites_email_status_idx" RENAME TO "mentor_invites_email_status_idx";--> statement-breakpoint
ALTER INDEX IF EXISTS "coach_applications_status_created_idx" RENAME TO "mentor_applications_status_created_idx";--> statement-breakpoint
ALTER INDEX IF EXISTS "coach_availability_rules_coach_idx" RENAME TO "mentor_availability_rules_mentor_idx";--> statement-breakpoint
ALTER INDEX IF EXISTS "coach_availability_blackouts_coach_day_unq" RENAME TO "mentor_availability_blackouts_mentor_day_unq";--> statement-breakpoint
ALTER INDEX IF EXISTS "session_holds_coach_slot_unq" RENAME TO "session_holds_mentor_slot_unq";--> statement-breakpoint
ALTER INDEX IF EXISTS "sessions_coach_start_idx" RENAME TO "sessions_mentor_start_idx";
