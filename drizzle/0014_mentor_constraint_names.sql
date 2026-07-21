-- Finish the rename: constraint names.
--
-- Postgres renames neither constraints nor their backing indexes when a table is renamed,
-- so after 0013 the tables were mentor_* while their primary keys and unique constraints
-- still read coach_*. Functionally irrelevant — nothing resolves a constraint by name at
-- runtime — but Drizzle derives the expected names from the table name, so leaving them
-- would make the next `generate` propose dropping and recreating each one.
--
-- RENAME CONSTRAINT rather than DROP/ADD: dropping a unique constraint even briefly would
-- open a window where duplicates could be inserted.

ALTER TABLE "mentor_profiles" RENAME CONSTRAINT "coach_profiles_pkey" TO "mentor_profiles_pkey";--> statement-breakpoint
ALTER TABLE "mentor_profiles" RENAME CONSTRAINT "coach_profiles_user_id_unique" TO "mentor_profiles_user_id_unique";--> statement-breakpoint
ALTER TABLE "mentor_profiles" RENAME CONSTRAINT "coach_profiles_referral_code_unique" TO "mentor_profiles_referral_code_unique";--> statement-breakpoint
ALTER TABLE "mentor_offerings" RENAME CONSTRAINT "coach_offerings_pkey" TO "mentor_offerings_pkey";--> statement-breakpoint
ALTER TABLE "mentor_student_links" RENAME CONSTRAINT "coach_student_links_pkey" TO "mentor_student_links_pkey";--> statement-breakpoint
ALTER TABLE "mentor_invites" RENAME CONSTRAINT "coach_invites_pkey" TO "mentor_invites_pkey";--> statement-breakpoint
ALTER TABLE "mentor_invites" RENAME CONSTRAINT "coach_invites_token_unique" TO "mentor_invites_token_unique";--> statement-breakpoint
ALTER TABLE "mentor_applications" RENAME CONSTRAINT "coach_applications_pkey" TO "mentor_applications_pkey";--> statement-breakpoint
ALTER TABLE "mentor_availability_rules" RENAME CONSTRAINT "coach_availability_rules_pkey" TO "mentor_availability_rules_pkey";--> statement-breakpoint
ALTER TABLE "mentor_availability_blackouts" RENAME CONSTRAINT "coach_availability_blackouts_pkey" TO "mentor_availability_blackouts_pkey";
