CREATE TABLE IF NOT EXISTS "shop_announcement_bars" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"messages" jsonb NOT NULL,
	"rotate_seconds" integer DEFAULT 0 NOT NULL,
	"background_color" text,
	"text_color" text,
	"is_dismissible" boolean DEFAULT true NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"show_on" text DEFAULT 'all' NOT NULL,
	"countdown_to" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "newsletter_subscribers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"email" text NOT NULL,
	"customer_id" uuid,
	"source" text NOT NULL,
	"status" text NOT NULL,
	"ip" "inet",
	"user_agent" text,
	"consent_text" text,
	"subscribed_at" timestamp with time zone NOT NULL,
	"unsubscribed_at" timestamp with time zone,
	"unsubscribe_token" text NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bulk_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"type" text NOT NULL,
	"resource" text NOT NULL,
	"status" text NOT NULL,
	"source_r_2_key" text,
	"options" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"total_rows" integer,
	"rows_processed" integer DEFAULT 0 NOT NULL,
	"rows_succeeded" integer DEFAULT 0 NOT NULL,
	"rows_failed" integer DEFAULT 0 NOT NULL,
	"errors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"result_r_2_key" text,
	"result_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "report_snapshots_daily" (
	"shop_id" uuid NOT NULL,
	"date" date NOT NULL,
	"orders_count" integer DEFAULT 0 NOT NULL,
	"orders_paid" integer DEFAULT 0 NOT NULL,
	"orders_cancelled" integer DEFAULT 0 NOT NULL,
	"gross_revenue" numeric(14, 2) DEFAULT '0' NOT NULL,
	"net_revenue" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_tax_collected" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_tax_owed" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_discounts" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_shipping" numeric(14, 2) DEFAULT '0' NOT NULL,
	"refunds_count" integer DEFAULT 0 NOT NULL,
	"refunds_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"customers_new" integer DEFAULT 0 NOT NULL,
	"customers_returning" integer DEFAULT 0 NOT NULL,
	"units_sold" integer DEFAULT 0 NOT NULL,
	"points_earned" integer DEFAULT 0 NOT NULL,
	"points_redeemed" integer DEFAULT 0 NOT NULL,
	"top_products" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"top_collections" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"top_discounts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"computed_at" timestamp with time zone NOT NULL,
	CONSTRAINT "report_snapshots_daily_shop_id_date_pk" PRIMARY KEY("shop_id","date")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "report_email_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"recipient_email" text NOT NULL,
	"reports" text[] NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "seo_redirects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"from_path" text NOT NULL,
	"to_path" text NOT NULL,
	"type" integer DEFAULT 301 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"hits_count" integer DEFAULT 0 NOT NULL,
	"last_hit_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "shop_announcement_bars" ADD CONSTRAINT "shop_announcement_bars_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "newsletter_subscribers" ADD CONSTRAINT "newsletter_subscribers_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "newsletter_subscribers" ADD CONSTRAINT "newsletter_subscribers_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bulk_jobs" ADD CONSTRAINT "bulk_jobs_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "report_snapshots_daily" ADD CONSTRAINT "report_snapshots_daily_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "report_email_subscriptions" ADD CONSTRAINT "report_email_subscriptions_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "seo_redirects" ADD CONSTRAINT "seo_redirects_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "announcement_bars_shop_active_idx" ON "shop_announcement_bars" USING btree ("shop_id","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "newsletter_shop_email_unique" ON "newsletter_subscribers" USING btree ("shop_id","email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "newsletter_shop_status_idx" ON "newsletter_subscribers" USING btree ("shop_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bulk_jobs_shop_created_idx" ON "bulk_jobs" USING btree ("shop_id","created_at" desc);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bulk_jobs_status_active_idx" ON "bulk_jobs" USING btree ("status") WHERE "bulk_jobs"."status" in ('queued', 'processing');--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "report_email_subs_shop_user_type_unique" ON "report_email_subscriptions" USING btree ("shop_id","user_id","type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "report_email_subs_type_active_idx" ON "report_email_subscriptions" USING btree ("type","is_active") WHERE "report_email_subscriptions"."is_active" = true;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "seo_redirects_shop_from_active_unique" ON "seo_redirects" USING btree ("shop_id","from_path") WHERE "seo_redirects"."is_active" = true;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "seo_redirects_shop_active_idx" ON "seo_redirects" USING btree ("shop_id","is_active");