CREATE TYPE "public"."coach_status" AS ENUM('pending', 'approved', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."education_level" AS ENUM('hs', 'college');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('open', 'reviewed', 'actioned');--> statement-breakpoint
CREATE TYPE "public"."session_status" AS ENUM('paid_unscheduled', 'booked', 'rescheduled', 'completed', 'canceled_free', 'canceled_late', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."sourced_via" AS ENUM('referral', 'platform');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('student', 'coach', 'admin');--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_id" text NOT NULL,
	"role" "user_role" NOT NULL,
	"email" text NOT NULL,
	"full_name" text,
	"referred_by_coach_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_clerk_id_unique" UNIQUE("clerk_id")
);
--> statement-breakpoint
CREATE TABLE "student_surveys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"education_level" "education_level" NOT NULL,
	"grade_year" text NOT NULL,
	"school" text NOT NULL,
	"major" text,
	"career_interest" text NOT NULL,
	"target" text,
	"path_certainty" smallint NOT NULL,
	"prior_experience" text,
	"help_with" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"help_with_other" text,
	"heard_from" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "student_surveys_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "student_surveys_path_certainty_range" CHECK ("student_surveys"."path_certainty" BETWEEN 1 AND 5)
);
--> statement-breakpoint
CREATE TABLE "coach_offerings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"coach_id" uuid NOT NULL,
	"length_minutes" smallint NOT NULL,
	"price_cents" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coach_offerings_coach_length_unq" UNIQUE("coach_id","length_minutes"),
	CONSTRAINT "coach_offerings_length_allowed" CHECK ("coach_offerings"."length_minutes" IN (30, 45, 60)),
	CONSTRAINT "coach_offerings_price_positive" CHECK ("coach_offerings"."price_cents" > 0)
);
--> statement-breakpoint
CREATE TABLE "coach_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"industry" text NOT NULL,
	"current_title" text NOT NULL,
	"bio" text NOT NULL,
	"headshot_url" text,
	"linkedin_url" text NOT NULL,
	"employer_note" text,
	"referral_code" text NOT NULL,
	"calendly_user_uri" text,
	"stripe_account_id" text,
	"status" "coach_status" DEFAULT 'pending' NOT NULL,
	"approved_at" timestamp with time zone,
	"approved_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coach_profiles_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "coach_profiles_referral_code_unique" UNIQUE("referral_code")
);
--> statement-breakpoint
CREATE TABLE "coach_student_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"coach_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"commission_bps" integer NOT NULL,
	"sourced_via" "sourced_via" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coach_student_links_pair_unq" UNIQUE("coach_id","student_id"),
	CONSTRAINT "coach_student_links_bps_allowed" CHECK ("coach_student_links"."commission_bps" IN (2000, 3000))
);
--> statement-breakpoint
CREATE TABLE "session_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"coach_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"coach_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"offering_id" uuid NOT NULL,
	"link_id" uuid NOT NULL,
	"amount_cents" integer NOT NULL,
	"commission_cents" integer NOT NULL,
	"coach_payout_cents" integer NOT NULL,
	"status" "session_status" DEFAULT 'paid_unscheduled' NOT NULL,
	"stripe_payment_intent_id" text,
	"calendly_event_uri" text,
	"calendly_invitee_uri" text,
	"scheduled_start" timestamp with time zone,
	"scheduled_end" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"canceled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_stripe_payment_intent_id_unique" UNIQUE("stripe_payment_intent_id"),
	CONSTRAINT "sessions_calendly_invitee_uri_unique" UNIQUE("calendly_invitee_uri"),
	CONSTRAINT "sessions_amount_split_balances" CHECK ("sessions"."amount_cents" = "sessions"."commission_cents" + "sessions"."coach_payout_cents"),
	CONSTRAINT "sessions_amount_positive" CHECK ("sessions"."amount_cents" > 0),
	CONSTRAINT "sessions_commission_non_negative" CHECK ("sessions"."commission_cents" >= 0),
	CONSTRAINT "sessions_payout_non_negative" CHECK ("sessions"."coach_payout_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_id" uuid NOT NULL,
	"reported_user_id" uuid NOT NULL,
	"session_id" uuid,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"status" "report_status" DEFAULT 'open' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_referred_by_coach_id_users_id_fk" FOREIGN KEY ("referred_by_coach_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_surveys" ADD CONSTRAINT "student_surveys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_offerings" ADD CONSTRAINT "coach_offerings_coach_id_users_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_profiles" ADD CONSTRAINT "coach_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_profiles" ADD CONSTRAINT "coach_profiles_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_student_links" ADD CONSTRAINT "coach_student_links_coach_id_users_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_student_links" ADD CONSTRAINT "coach_student_links_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_notes" ADD CONSTRAINT "session_notes_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_notes" ADD CONSTRAINT "session_notes_coach_id_users_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_coach_id_users_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_offering_id_coach_offerings_id_fk" FOREIGN KEY ("offering_id") REFERENCES "public"."coach_offerings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_link_id_coach_student_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."coach_student_links"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reported_user_id_users_id_fk" FOREIGN KEY ("reported_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_referred_by_idx" ON "users" USING btree ("referred_by_coach_id");--> statement-breakpoint
CREATE INDEX "coach_offerings_coach_idx" ON "coach_offerings" USING btree ("coach_id");--> statement-breakpoint
CREATE INDEX "coach_profiles_status_idx" ON "coach_profiles" USING btree ("status");--> statement-breakpoint
CREATE INDEX "coach_profiles_industry_idx" ON "coach_profiles" USING btree ("industry");--> statement-breakpoint
CREATE INDEX "coach_student_links_student_idx" ON "coach_student_links" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "session_notes_session_idx" ON "session_notes" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "sessions_coach_start_idx" ON "sessions" USING btree ("coach_id","scheduled_start");--> statement-breakpoint
CREATE INDEX "sessions_student_start_idx" ON "sessions" USING btree ("student_id","scheduled_start");--> statement-breakpoint
CREATE INDEX "sessions_status_end_idx" ON "sessions" USING btree ("status","scheduled_end");--> statement-breakpoint
CREATE INDEX "sessions_link_idx" ON "sessions" USING btree ("link_id");--> statement-breakpoint
CREATE INDEX "notifications_user_created_idx" ON "notifications" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "notifications_unread_idx" ON "notifications" USING btree ("user_id") WHERE "notifications"."read_at" IS NULL;--> statement-breakpoint
CREATE INDEX "reports_status_created_idx" ON "reports" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "reports_reported_user_idx" ON "reports" USING btree ("reported_user_id");