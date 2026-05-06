CREATE TABLE IF NOT EXISTS "galleries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"title" text NOT NULL,
	"handle" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"seo_title" text,
	"seo_description" text,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "gallery_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gallery_id" uuid NOT NULL,
	"shop_id" uuid NOT NULL,
	"uuid" uuid DEFAULT gen_random_uuid() NOT NULL,
	"ext" text NOT NULL,
	"r2_key_orig" text NOT NULL,
	"alt" text,
	"caption" text,
	"position" integer DEFAULT 0 NOT NULL,
	"width" integer,
	"height" integer,
	"bytes" integer,
	"variants_status" text DEFAULT 'pending' NOT NULL,
	"variants_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "gallery_images_uuid_unique" UNIQUE("uuid")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "galleries" ADD CONSTRAINT "galleries_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "gallery_images" ADD CONSTRAINT "gallery_images_gallery_id_galleries_id_fk" FOREIGN KEY ("gallery_id") REFERENCES "public"."galleries"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "gallery_images" ADD CONSTRAINT "gallery_images_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "galleries_shop_handle_unique" ON "galleries" USING btree ("shop_id","handle");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "galleries_shop_status_idx" ON "galleries" USING btree ("shop_id","status");