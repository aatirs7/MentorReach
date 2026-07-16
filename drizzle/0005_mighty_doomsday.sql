CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"details" text,
	"category" text NOT NULL,
	"owner" text NOT NULL,
	"status" text DEFAULT 'todo' NOT NULL,
	"this_week" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "coach_profiles" ALTER COLUMN "linkedin_url" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "coach_profiles" ADD COLUMN "stripe_payouts_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "coach_profiles" ADD COLUMN "handbook_ack_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "tasks_category_sort_idx" ON "tasks" USING btree ("category","sort_order");