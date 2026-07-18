CREATE TABLE "coach_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"full_name" text,
	"token" text NOT NULL,
	"prefill_field" text,
	"prefill_title" text,
	"invited_by" uuid,
	"status" text DEFAULT 'pending' NOT NULL,
	"accepted_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accepted_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	CONSTRAINT "coach_invites_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "coach_profiles" ADD COLUMN "resume_url" text;--> statement-breakpoint
ALTER TABLE "coach_profiles" ADD COLUMN "onboarding_completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "coach_invites" ADD CONSTRAINT "coach_invites_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_invites" ADD CONSTRAINT "coach_invites_accepted_user_id_users_id_fk" FOREIGN KEY ("accepted_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "coach_invites_email_status_idx" ON "coach_invites" USING btree ("email","status");