CREATE TABLE IF NOT EXISTS "discounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"code" text,
	"title" text NOT NULL,
	"status" text NOT NULL,
	"type" text NOT NULL,
	"value" numeric(12, 2),
	"applies_to" text NOT NULL,
	"target_ids" uuid[] DEFAULT '{}' NOT NULL,
	"minimum_amount" numeric(12, 2),
	"minimum_quantity" integer,
	"customer_eligibility" text NOT NULL,
	"customer_ids" uuid[] DEFAULT '{}' NOT NULL,
	"usage_limit" integer,
	"usage_limit_per_customer" integer,
	"used_count" integer DEFAULT 0 NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"combines_with" jsonb DEFAULT '{"product":false,"order":false,"shipping":false}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "discount_usages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"discount_id" uuid NOT NULL,
	"customer_id" uuid,
	"order_id" uuid NOT NULL,
	"shop_id" uuid NOT NULL,
	"used_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tax_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"name" text NOT NULL,
	"rate" numeric(5, 4) NOT NULL,
	"country" text,
	"province" text,
	"applies_to" text DEFAULT 'all' NOT NULL,
	"is_compound" boolean DEFAULT false NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cart_discount_codes" (
	"cart_id" uuid NOT NULL,
	"discount_id" uuid NOT NULL,
	CONSTRAINT "cart_discount_codes_cart_id_discount_id_pk" PRIMARY KEY("cart_id","discount_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "order_discount_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"discount_id" uuid,
	"code" text,
	"type" text NOT NULL,
	"value" numeric(12, 2) NOT NULL,
	"amount_applied" numeric(12, 2) NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "discounts" ADD CONSTRAINT "discounts_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "discount_usages" ADD CONSTRAINT "discount_usages_discount_id_discounts_id_fk" FOREIGN KEY ("discount_id") REFERENCES "public"."discounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "discount_usages" ADD CONSTRAINT "discount_usages_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "discount_usages" ADD CONSTRAINT "discount_usages_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "discount_usages" ADD CONSTRAINT "discount_usages_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tax_rates" ADD CONSTRAINT "tax_rates_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cart_discount_codes" ADD CONSTRAINT "cart_discount_codes_cart_id_carts_id_fk" FOREIGN KEY ("cart_id") REFERENCES "public"."carts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cart_discount_codes" ADD CONSTRAINT "cart_discount_codes_discount_id_discounts_id_fk" FOREIGN KEY ("discount_id") REFERENCES "public"."discounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "order_discount_applications" ADD CONSTRAINT "order_discount_applications_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "order_discount_applications" ADD CONSTRAINT "order_discount_applications_discount_id_discounts_id_fk" FOREIGN KEY ("discount_id") REFERENCES "public"."discounts"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "discounts_shop_code_unique" ON "discounts" USING btree ("shop_id","code") WHERE "discounts"."code" is not null;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "discounts_shop_status_idx" ON "discounts" USING btree ("shop_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "discount_usages_discount_customer_idx" ON "discount_usages" USING btree ("discount_id","customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tax_rates_shop_region_applies_unique" ON "tax_rates" USING btree ("shop_id","country","province","applies_to");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tax_rates_shop_country_province_idx" ON "tax_rates" USING btree ("shop_id","country","province");