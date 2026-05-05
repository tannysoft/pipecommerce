CREATE TABLE IF NOT EXISTS "locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"name" text NOT NULL,
	"address" jsonb,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inventory_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"available" integer DEFAULT 0 NOT NULL,
	"committed" integer DEFAULT 0 NOT NULL,
	"on_hand" integer GENERATED ALWAYS AS (available + committed) STORED
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inventory_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inventory_item_id" uuid NOT NULL,
	"shop_id" uuid NOT NULL,
	"delta" integer NOT NULL,
	"reason" text NOT NULL,
	"reference_id" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "locations" ADD CONSTRAINT "locations_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_items_variant_location_unique" ON "inventory_items" USING btree ("variant_id","location_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inventory_movements_item_created_idx" ON "inventory_movements" USING btree ("inventory_item_id","created_at");