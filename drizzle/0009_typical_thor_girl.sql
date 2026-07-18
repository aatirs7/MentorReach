CREATE TABLE "coach_availability_blackouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"coach_id" uuid NOT NULL,
	"day" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coach_availability_blackouts_coach_day_unq" UNIQUE("coach_id","day")
);
--> statement-breakpoint
CREATE TABLE "coach_availability_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"coach_id" uuid NOT NULL,
	"weekday" smallint NOT NULL,
	"start_minute" integer NOT NULL,
	"end_minute" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "availability_weekday_range" CHECK ("coach_availability_rules"."weekday" >= 0 AND "coach_availability_rules"."weekday" <= 6),
	CONSTRAINT "availability_minute_range" CHECK ("coach_availability_rules"."start_minute" >= 0 AND "coach_availability_rules"."end_minute" <= 1440 AND "coach_availability_rules"."start_minute" < "coach_availability_rules"."end_minute")
);
--> statement-breakpoint
CREATE TABLE "session_holds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"coach_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"offering_id" uuid NOT NULL,
	"link_id" uuid NOT NULL,
	"slot_start" timestamp with time zone NOT NULL,
	"slot_end" timestamp with time zone NOT NULL,
	"policy_ack_at" timestamp with time zone NOT NULL,
	"stripe_checkout_session_id" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_holds_coach_slot_unq" UNIQUE("coach_id","slot_start")
);
--> statement-breakpoint
ALTER TABLE "coach_profiles" ADD COLUMN "timezone" text DEFAULT 'America/New_York' NOT NULL;--> statement-breakpoint
ALTER TABLE "coach_profiles" ADD COLUMN "booking_buffer_minutes" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "coach_profiles" ADD COLUMN "min_notice_hours" smallint DEFAULT 12 NOT NULL;--> statement-breakpoint
ALTER TABLE "coach_profiles" ADD COLUMN "max_bookings_per_day" smallint;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "zoom_meeting_id" text;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "zoom_join_url" text;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "zoom_start_url" text;--> statement-breakpoint
ALTER TABLE "coach_availability_blackouts" ADD CONSTRAINT "coach_availability_blackouts_coach_id_users_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_availability_rules" ADD CONSTRAINT "coach_availability_rules_coach_id_users_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_holds" ADD CONSTRAINT "session_holds_coach_id_users_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_holds" ADD CONSTRAINT "session_holds_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_holds" ADD CONSTRAINT "session_holds_offering_id_coach_offerings_id_fk" FOREIGN KEY ("offering_id") REFERENCES "public"."coach_offerings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_holds" ADD CONSTRAINT "session_holds_link_id_coach_student_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."coach_student_links"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "coach_availability_rules_coach_idx" ON "coach_availability_rules" USING btree ("coach_id");--> statement-breakpoint
CREATE INDEX "session_holds_expires_idx" ON "session_holds" USING btree ("expires_at");