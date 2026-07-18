ALTER TABLE "sessions" DROP CONSTRAINT "sessions_calendly_invitee_uri_unique";--> statement-breakpoint
ALTER TABLE "coach_profiles" DROP COLUMN "calendly_user_uri";--> statement-breakpoint
ALTER TABLE "coach_profiles" DROP COLUMN "calendly_scheduling_url";--> statement-breakpoint
ALTER TABLE "sessions" DROP COLUMN "calendly_event_uri";--> statement-breakpoint
ALTER TABLE "sessions" DROP COLUMN "calendly_invitee_uri";