ALTER TABLE "coach_profiles" ADD COLUMN "specialties" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "coach_profiles" ADD COLUMN "is_seed" boolean DEFAULT false NOT NULL;