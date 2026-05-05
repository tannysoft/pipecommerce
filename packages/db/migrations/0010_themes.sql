CREATE TABLE IF NOT EXISTS "themes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text,
	"preview_image_r_2_key" text,
	"thumbnail_r_2_key" text,
	"version" text NOT NULL,
	"schema" jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"available_on_plans" uuid[] DEFAULT '{}' NOT NULL,
	"released_at" timestamp with time zone,
	"deprecated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shop_theme_settings" (
	"shop_id" uuid PRIMARY KEY NOT NULL,
	"theme_id" uuid NOT NULL,
	"theme_code" text NOT NULL,
	"theme_version" text NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"templates" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"published_at" timestamp with time zone,
	"published_by" uuid,
	"draft_settings" jsonb,
	"draft_templates" jsonb,
	"draft_updated_at" timestamp with time zone,
	"draft_updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shop_theme_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"key" text NOT NULL,
	"uuid" uuid DEFAULT gen_random_uuid() NOT NULL,
	"ext" text NOT NULL,
	"r2_key_orig" text NOT NULL,
	"alt" text,
	"width" integer,
	"height" integer,
	"bytes" integer,
	"variants_status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "shop_theme_assets_uuid_unique" UNIQUE("uuid")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "theme_draft_tokens" (
	"token" text PRIMARY KEY NOT NULL,
	"shop_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "shop_theme_settings" ADD CONSTRAINT "shop_theme_settings_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "shop_theme_settings" ADD CONSTRAINT "shop_theme_settings_theme_id_themes_id_fk" FOREIGN KEY ("theme_id") REFERENCES "public"."themes"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "shop_theme_assets" ADD CONSTRAINT "shop_theme_assets_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "theme_draft_tokens" ADD CONSTRAINT "theme_draft_tokens_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "themes_code_version_unique" ON "themes" USING btree ("code","version");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shop_theme_assets_shop_key_unique" ON "shop_theme_assets" USING btree ("shop_id","key") WHERE "shop_theme_assets"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "theme_draft_tokens_expires_idx" ON "theme_draft_tokens" USING btree ("expires_at");