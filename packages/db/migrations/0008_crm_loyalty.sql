CREATE TABLE IF NOT EXISTS "customer_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"type" text NOT NULL,
	"rules" jsonb,
	"perks" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customer_group_members" (
	"group_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"shop_id" uuid NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	"added_by" text NOT NULL,
	CONSTRAINT "customer_group_members_group_id_customer_id_pk" PRIMARY KEY("group_id","customer_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customer_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"shop_id" uuid NOT NULL,
	"note" text NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "loyalty_programs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"earn_rate_amount" numeric(12, 2) NOT NULL,
	"earn_on_subtotal" boolean DEFAULT true NOT NULL,
	"earn_excludes_discounts" boolean DEFAULT true NOT NULL,
	"signup_bonus_points" integer DEFAULT 0 NOT NULL,
	"redeem_min_points" integer DEFAULT 100 NOT NULL,
	"redeem_value_per_point" numeric(12, 4) NOT NULL,
	"redeem_step" integer DEFAULT 1 NOT NULL,
	"redeem_max_pct_of_order" numeric(5, 2),
	"points_expiry_months" integer,
	"expiry_warning_days" integer DEFAULT 30 NOT NULL,
	"terms_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customer_loyalty" (
	"customer_id" uuid PRIMARY KEY NOT NULL,
	"shop_id" uuid NOT NULL,
	"program_id" uuid NOT NULL,
	"points_balance" integer DEFAULT 0 NOT NULL,
	"points_lifetime" integer DEFAULT 0 NOT NULL,
	"points_expiring_soon" integer DEFAULT 0 NOT NULL,
	"next_expiry_at" timestamp with time zone,
	"enrolled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_activity_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "loyalty_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"shop_id" uuid NOT NULL,
	"program_id" uuid NOT NULL,
	"type" text NOT NULL,
	"points" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"reason" text NOT NULL,
	"reference_type" text,
	"reference_id" uuid,
	"expires_at" timestamp with time zone,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "loyalty_redemptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cart_id" uuid,
	"order_id" uuid,
	"customer_id" uuid NOT NULL,
	"shop_id" uuid NOT NULL,
	"program_id" uuid NOT NULL,
	"points_used" integer NOT NULL,
	"amount_applied" numeric(12, 2) NOT NULL,
	"ledger_id" uuid,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "loyalty_redemptions_points_positive" CHECK ("loyalty_redemptions"."points_used" > 0)
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_groups" ADD CONSTRAINT "customer_groups_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_group_members" ADD CONSTRAINT "customer_group_members_group_id_customer_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."customer_groups"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_group_members" ADD CONSTRAINT "customer_group_members_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_group_members" ADD CONSTRAINT "customer_group_members_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_notes" ADD CONSTRAINT "customer_notes_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_notes" ADD CONSTRAINT "customer_notes_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "loyalty_programs" ADD CONSTRAINT "loyalty_programs_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_loyalty" ADD CONSTRAINT "customer_loyalty_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_loyalty" ADD CONSTRAINT "customer_loyalty_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_loyalty" ADD CONSTRAINT "customer_loyalty_program_id_loyalty_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."loyalty_programs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "loyalty_ledger" ADD CONSTRAINT "loyalty_ledger_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "loyalty_ledger" ADD CONSTRAINT "loyalty_ledger_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "loyalty_ledger" ADD CONSTRAINT "loyalty_ledger_program_id_loyalty_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."loyalty_programs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "loyalty_redemptions" ADD CONSTRAINT "loyalty_redemptions_cart_id_carts_id_fk" FOREIGN KEY ("cart_id") REFERENCES "public"."carts"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "loyalty_redemptions" ADD CONSTRAINT "loyalty_redemptions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "loyalty_redemptions" ADD CONSTRAINT "loyalty_redemptions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "loyalty_redemptions" ADD CONSTRAINT "loyalty_redemptions_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "loyalty_redemptions" ADD CONSTRAINT "loyalty_redemptions_program_id_loyalty_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."loyalty_programs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "loyalty_redemptions" ADD CONSTRAINT "loyalty_redemptions_ledger_id_loyalty_ledger_id_fk" FOREIGN KEY ("ledger_id") REFERENCES "public"."loyalty_ledger"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "customer_groups_shop_name_unique" ON "customer_groups" USING btree ("shop_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "loyalty_programs_shop_name_unique" ON "loyalty_programs" USING btree ("shop_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "loyalty_programs_shop_active_unique" ON "loyalty_programs" USING btree ("shop_id") WHERE "loyalty_programs"."is_active" = true;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_loyalty_shop_balance_idx" ON "customer_loyalty" USING btree ("shop_id","points_balance");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "loyalty_ledger_customer_created_idx" ON "loyalty_ledger" USING btree ("customer_id","created_at" desc);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "loyalty_ledger_shop_type_created_idx" ON "loyalty_ledger" USING btree ("shop_id","type","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "loyalty_ledger_reference_idx" ON "loyalty_ledger" USING btree ("reference_type","reference_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "loyalty_ledger_expires_idx" ON "loyalty_ledger" USING btree ("expires_at") WHERE "loyalty_ledger"."type" = 'earn' AND "loyalty_ledger"."expires_at" is not null;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "loyalty_redemptions_cart_idx" ON "loyalty_redemptions" USING btree ("cart_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "loyalty_redemptions_order_idx" ON "loyalty_redemptions" USING btree ("order_id");