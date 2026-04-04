import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_users_role" AS ENUM('user', 'admin', 'system');
  CREATE TYPE "public"."enum_media_type" AS ENUM('avatar', 'attachment', 'other');
  CREATE TYPE "public"."enum_media_entity_type" AS ENUM('person', 'account', 'transaction', 'other');
  CREATE TYPE "public"."enum_categories_type" AS ENUM('income', 'expense', 'transfer');
  CREATE TYPE "public"."enum_transactions_type" AS ENUM('income', 'expense', 'transfer');
  CREATE TYPE "public"."enum_reminders_type" AS ENUM('income', 'expense', 'transfer');
  CREATE TYPE "public"."enum_reminders_recurrence_type" AS ENUM('daily', 'weekly', 'monthly', 'yearly');
  CREATE TYPE "public"."enum_user_settings_theme" AS ENUM('light', 'dark', 'system');
  CREATE TYPE "public"."enum_ai_usages_prompt_type" AS ENUM('text', 'image');
  CREATE TYPE "public"."enum_ai_usages_status" AS ENUM('success', 'error');
  CREATE TYPE "public"."enum_ai_usages_api_key_type" AS ENUM('user', 'app');
  CREATE TABLE "users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "users" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"name" varchar,
  	"avatar_id" uuid,
  	"role" "enum_users_role" DEFAULT 'user',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "media" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"alt" varchar,
  	"type" "enum_media_type" DEFAULT 'other',
  	"entity_type" "enum_media_entity_type" DEFAULT 'other',
  	"user_id" uuid NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric
  );
  
  CREATE TABLE "accounts" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"user_id" uuid NOT NULL,
  	"name" varchar NOT NULL,
  	"icon" varchar DEFAULT 'wallet' NOT NULL,
  	"bg_color" varchar,
  	"color" varchar,
  	"avatar_id" uuid,
  	"description" varchar,
  	"is_active" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "people" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"user_id" uuid NOT NULL,
  	"name" varchar NOT NULL,
  	"email" varchar,
  	"phone" varchar,
  	"avatar_id" uuid,
  	"description" varchar,
  	"is_active" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "categories" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"user_id" uuid NOT NULL,
  	"name" varchar NOT NULL,
  	"type" "enum_categories_type" NOT NULL,
  	"parent_id" uuid,
  	"icon" varchar DEFAULT 'folder' NOT NULL,
  	"color" varchar,
  	"bg_color" varchar,
  	"description" varchar,
  	"is_active" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "tags" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"user_id" uuid NOT NULL,
  	"name" varchar NOT NULL,
  	"icon" varchar DEFAULT 'tag' NOT NULL,
  	"color" varchar,
  	"bg_color" varchar,
  	"description" varchar,
  	"is_active" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "transactions" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"user_id" uuid NOT NULL,
  	"title" varchar NOT NULL,
  	"amount" varchar NOT NULL,
  	"date" timestamp(3) with time zone NOT NULL,
  	"type" "enum_transactions_type" NOT NULL,
  	"category_id" uuid,
  	"account_id" uuid NOT NULL,
  	"to_account_id" uuid,
  	"person_id" uuid,
  	"note" varchar,
  	"is_active" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"deleted_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "transactions_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"tags_id" uuid,
  	"media_id" uuid
  );
  
  CREATE TABLE "reminders_completed_dates" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"date" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "reminders" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"user_id" uuid NOT NULL,
  	"title" varchar NOT NULL,
  	"amount" varchar,
  	"type" "enum_reminders_type",
  	"category_id" uuid,
  	"account_id" uuid,
  	"member_id" uuid,
  	"date" timestamp(3) with time zone,
  	"is_recurring" boolean DEFAULT false,
  	"recurrence_period" numeric,
  	"recurrence_type" "enum_reminders_recurrence_type",
  	"last_triggered_at" timestamp(3) with time zone,
  	"next_due_date" timestamp(3) with time zone,
  	"archived" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "reminders_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"tags_id" uuid
  );
  
  CREATE TABLE "user_settings" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"user_id" uuid NOT NULL,
  	"currency" varchar DEFAULT 'USD',
  	"timezone" varchar DEFAULT 'UTC',
  	"locale" varchar DEFAULT 'en',
  	"theme" "enum_user_settings_theme" DEFAULT 'system',
  	"default_account_id" uuid,
  	"gemini_api_key" varchar,
  	"settings" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "ai_usages" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"user_id" uuid NOT NULL,
  	"prompt_type" "enum_ai_usages_prompt_type" NOT NULL,
  	"model" varchar,
  	"prompt_tokens" numeric DEFAULT 0,
  	"candidate_tokens" numeric DEFAULT 0,
  	"total_tokens" numeric DEFAULT 0,
  	"latency_ms" numeric DEFAULT 0,
  	"status" "enum_ai_usages_status" NOT NULL,
  	"api_key_type" "enum_ai_usages_api_key_type",
  	"error" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "oauth_accounts" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"name" varchar,
  	"picture" varchar,
  	"user_id" uuid NOT NULL,
  	"issuer_name" varchar NOT NULL,
  	"scope" varchar,
  	"sub" varchar NOT NULL,
  	"access_token" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_mcp_api_keys" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"user_id" uuid NOT NULL,
  	"label" varchar,
  	"description" varchar,
  	"users_find" boolean DEFAULT false,
  	"media_find" boolean DEFAULT false,
  	"accounts_find" boolean DEFAULT false,
  	"accounts_create" boolean DEFAULT false,
  	"accounts_update" boolean DEFAULT false,
  	"accounts_delete" boolean DEFAULT false,
  	"people_find" boolean DEFAULT false,
  	"people_create" boolean DEFAULT false,
  	"people_update" boolean DEFAULT false,
  	"people_delete" boolean DEFAULT false,
  	"categories_find" boolean DEFAULT false,
  	"categories_create" boolean DEFAULT false,
  	"categories_update" boolean DEFAULT false,
  	"categories_delete" boolean DEFAULT false,
  	"tags_find" boolean DEFAULT false,
  	"tags_create" boolean DEFAULT false,
  	"tags_update" boolean DEFAULT false,
  	"tags_delete" boolean DEFAULT false,
  	"transactions_find" boolean DEFAULT false,
  	"transactions_create" boolean DEFAULT false,
  	"transactions_update" boolean DEFAULT false,
  	"transactions_delete" boolean DEFAULT false,
  	"reminders_find" boolean DEFAULT false,
  	"reminders_create" boolean DEFAULT false,
  	"reminders_update" boolean DEFAULT false,
  	"reminders_delete" boolean DEFAULT false,
  	"user_settings_find" boolean DEFAULT false,
  	"user_settings_update" boolean DEFAULT false,
  	"payload_mcp_tool_get_dashboard_summary" boolean DEFAULT true,
  	"payload_mcp_tool_get_monthly_categories" boolean DEFAULT true,
  	"payload_mcp_tool_get_monthly_tags" boolean DEFAULT true,
  	"payload_mcp_tool_get_monthly_people" boolean DEFAULT true,
  	"payload_mcp_resource_currencies" boolean DEFAULT true,
  	"payload_mcp_resource_currency" boolean DEFAULT true,
  	"payload_mcp_resource_timezones" boolean DEFAULT true,
  	"payload_mcp_resource_timezone" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"enable_a_p_i_key" boolean,
  	"api_key" varchar,
  	"api_key_index" varchar
  );
  
  CREATE TABLE "payload_kv" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" uuid,
  	"media_id" uuid,
  	"accounts_id" uuid,
  	"people_id" uuid,
  	"categories_id" uuid,
  	"tags_id" uuid,
  	"transactions_id" uuid,
  	"reminders_id" uuid,
  	"user_settings_id" uuid,
  	"ai_usages_id" uuid,
  	"oauth_accounts_id" uuid,
  	"payload_mcp_api_keys_id" uuid
  );
  
  CREATE TABLE "payload_preferences" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" uuid,
  	"payload_mcp_api_keys_id" uuid
  );
  
  CREATE TABLE "payload_migrations" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "app_settings_ai_models" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL
  );
  
  CREATE TABLE "app_settings" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"ai_enabled" boolean DEFAULT true,
  	"ai_gemini_api_key" varchar,
  	"ai_allow_user_api_key" boolean DEFAULT true,
  	"ai_default_model" varchar DEFAULT 'gemini-2.5-flash',
  	"ai_per_user_daily_limit" numeric DEFAULT 20,
  	"ai_per_user_monthly_limit" numeric DEFAULT 200,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users" ADD CONSTRAINT "users_avatar_id_media_id_fk" FOREIGN KEY ("avatar_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "media" ADD CONSTRAINT "media_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "accounts" ADD CONSTRAINT "accounts_avatar_id_media_id_fk" FOREIGN KEY ("avatar_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "people" ADD CONSTRAINT "people_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "people" ADD CONSTRAINT "people_avatar_id_media_id_fk" FOREIGN KEY ("avatar_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "categories" ADD CONSTRAINT "categories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "tags" ADD CONSTRAINT "tags_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "transactions" ADD CONSTRAINT "transactions_to_account_id_accounts_id_fk" FOREIGN KEY ("to_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "transactions" ADD CONSTRAINT "transactions_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "transactions_rels" ADD CONSTRAINT "transactions_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "transactions_rels" ADD CONSTRAINT "transactions_rels_tags_fk" FOREIGN KEY ("tags_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "transactions_rels" ADD CONSTRAINT "transactions_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "reminders_completed_dates" ADD CONSTRAINT "reminders_completed_dates_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."reminders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "reminders" ADD CONSTRAINT "reminders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "reminders" ADD CONSTRAINT "reminders_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "reminders" ADD CONSTRAINT "reminders_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "reminders" ADD CONSTRAINT "reminders_member_id_people_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "reminders_rels" ADD CONSTRAINT "reminders_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."reminders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "reminders_rels" ADD CONSTRAINT "reminders_rels_tags_fk" FOREIGN KEY ("tags_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_default_account_id_accounts_id_fk" FOREIGN KEY ("default_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "ai_usages" ADD CONSTRAINT "ai_usages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "oauth_accounts" ADD CONSTRAINT "oauth_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_mcp_api_keys" ADD CONSTRAINT "payload_mcp_api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_accounts_fk" FOREIGN KEY ("accounts_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_people_fk" FOREIGN KEY ("people_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_tags_fk" FOREIGN KEY ("tags_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_transactions_fk" FOREIGN KEY ("transactions_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_reminders_fk" FOREIGN KEY ("reminders_id") REFERENCES "public"."reminders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_user_settings_fk" FOREIGN KEY ("user_settings_id") REFERENCES "public"."user_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_ai_usages_fk" FOREIGN KEY ("ai_usages_id") REFERENCES "public"."ai_usages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_oauth_accounts_fk" FOREIGN KEY ("oauth_accounts_id") REFERENCES "public"."oauth_accounts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payload_mcp_api_keys_fk" FOREIGN KEY ("payload_mcp_api_keys_id") REFERENCES "public"."payload_mcp_api_keys"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_payload_mcp_api_keys_fk" FOREIGN KEY ("payload_mcp_api_keys_id") REFERENCES "public"."payload_mcp_api_keys"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "app_settings_ai_models" ADD CONSTRAINT "app_settings_ai_models_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."app_settings"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "users_sessions_order_idx" ON "users_sessions" USING btree ("_order");
  CREATE INDEX "users_sessions_parent_id_idx" ON "users_sessions" USING btree ("_parent_id");
  CREATE INDEX "users_avatar_idx" ON "users" USING btree ("avatar_id");
  CREATE INDEX "users_updated_at_idx" ON "users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");
  CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");
  CREATE INDEX "media_user_idx" ON "media" USING btree ("user_id");
  CREATE INDEX "media_updated_at_idx" ON "media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "media" USING btree ("filename");
  CREATE INDEX "accounts_user_idx" ON "accounts" USING btree ("user_id");
  CREATE INDEX "accounts_avatar_idx" ON "accounts" USING btree ("avatar_id");
  CREATE INDEX "accounts_updated_at_idx" ON "accounts" USING btree ("updated_at");
  CREATE INDEX "accounts_created_at_idx" ON "accounts" USING btree ("created_at");
  CREATE INDEX "people_user_idx" ON "people" USING btree ("user_id");
  CREATE INDEX "people_avatar_idx" ON "people" USING btree ("avatar_id");
  CREATE INDEX "people_updated_at_idx" ON "people" USING btree ("updated_at");
  CREATE INDEX "people_created_at_idx" ON "people" USING btree ("created_at");
  CREATE INDEX "categories_user_idx" ON "categories" USING btree ("user_id");
  CREATE INDEX "categories_parent_idx" ON "categories" USING btree ("parent_id");
  CREATE INDEX "categories_updated_at_idx" ON "categories" USING btree ("updated_at");
  CREATE INDEX "categories_created_at_idx" ON "categories" USING btree ("created_at");
  CREATE INDEX "tags_user_idx" ON "tags" USING btree ("user_id");
  CREATE INDEX "tags_updated_at_idx" ON "tags" USING btree ("updated_at");
  CREATE INDEX "tags_created_at_idx" ON "tags" USING btree ("created_at");
  CREATE INDEX "transactions_user_idx" ON "transactions" USING btree ("user_id");
  CREATE INDEX "transactions_category_idx" ON "transactions" USING btree ("category_id");
  CREATE INDEX "transactions_account_idx" ON "transactions" USING btree ("account_id");
  CREATE INDEX "transactions_to_account_idx" ON "transactions" USING btree ("to_account_id");
  CREATE INDEX "transactions_person_idx" ON "transactions" USING btree ("person_id");
  CREATE INDEX "transactions_updated_at_idx" ON "transactions" USING btree ("updated_at");
  CREATE INDEX "transactions_created_at_idx" ON "transactions" USING btree ("created_at");
  CREATE INDEX "transactions_deleted_at_idx" ON "transactions" USING btree ("deleted_at");
  CREATE INDEX "transactions_rels_order_idx" ON "transactions_rels" USING btree ("order");
  CREATE INDEX "transactions_rels_parent_idx" ON "transactions_rels" USING btree ("parent_id");
  CREATE INDEX "transactions_rels_path_idx" ON "transactions_rels" USING btree ("path");
  CREATE INDEX "transactions_rels_tags_id_idx" ON "transactions_rels" USING btree ("tags_id");
  CREATE INDEX "transactions_rels_media_id_idx" ON "transactions_rels" USING btree ("media_id");
  CREATE INDEX "reminders_completed_dates_order_idx" ON "reminders_completed_dates" USING btree ("_order");
  CREATE INDEX "reminders_completed_dates_parent_id_idx" ON "reminders_completed_dates" USING btree ("_parent_id");
  CREATE INDEX "reminders_user_idx" ON "reminders" USING btree ("user_id");
  CREATE INDEX "reminders_category_idx" ON "reminders" USING btree ("category_id");
  CREATE INDEX "reminders_account_idx" ON "reminders" USING btree ("account_id");
  CREATE INDEX "reminders_member_idx" ON "reminders" USING btree ("member_id");
  CREATE INDEX "reminders_updated_at_idx" ON "reminders" USING btree ("updated_at");
  CREATE INDEX "reminders_created_at_idx" ON "reminders" USING btree ("created_at");
  CREATE INDEX "reminders_rels_order_idx" ON "reminders_rels" USING btree ("order");
  CREATE INDEX "reminders_rels_parent_idx" ON "reminders_rels" USING btree ("parent_id");
  CREATE INDEX "reminders_rels_path_idx" ON "reminders_rels" USING btree ("path");
  CREATE INDEX "reminders_rels_tags_id_idx" ON "reminders_rels" USING btree ("tags_id");
  CREATE UNIQUE INDEX "user_settings_user_idx" ON "user_settings" USING btree ("user_id");
  CREATE INDEX "user_settings_default_account_idx" ON "user_settings" USING btree ("default_account_id");
  CREATE INDEX "user_settings_updated_at_idx" ON "user_settings" USING btree ("updated_at");
  CREATE INDEX "user_settings_created_at_idx" ON "user_settings" USING btree ("created_at");
  CREATE INDEX "ai_usages_user_idx" ON "ai_usages" USING btree ("user_id");
  CREATE INDEX "ai_usages_updated_at_idx" ON "ai_usages" USING btree ("updated_at");
  CREATE INDEX "ai_usages_created_at_idx" ON "ai_usages" USING btree ("created_at");
  CREATE INDEX "oauth_accounts_user_idx" ON "oauth_accounts" USING btree ("user_id");
  CREATE INDEX "oauth_accounts_updated_at_idx" ON "oauth_accounts" USING btree ("updated_at");
  CREATE INDEX "oauth_accounts_created_at_idx" ON "oauth_accounts" USING btree ("created_at");
  CREATE INDEX "payload_mcp_api_keys_user_idx" ON "payload_mcp_api_keys" USING btree ("user_id");
  CREATE INDEX "payload_mcp_api_keys_updated_at_idx" ON "payload_mcp_api_keys" USING btree ("updated_at");
  CREATE INDEX "payload_mcp_api_keys_created_at_idx" ON "payload_mcp_api_keys" USING btree ("created_at");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_locked_documents_rels_accounts_id_idx" ON "payload_locked_documents_rels" USING btree ("accounts_id");
  CREATE INDEX "payload_locked_documents_rels_people_id_idx" ON "payload_locked_documents_rels" USING btree ("people_id");
  CREATE INDEX "payload_locked_documents_rels_categories_id_idx" ON "payload_locked_documents_rels" USING btree ("categories_id");
  CREATE INDEX "payload_locked_documents_rels_tags_id_idx" ON "payload_locked_documents_rels" USING btree ("tags_id");
  CREATE INDEX "payload_locked_documents_rels_transactions_id_idx" ON "payload_locked_documents_rels" USING btree ("transactions_id");
  CREATE INDEX "payload_locked_documents_rels_reminders_id_idx" ON "payload_locked_documents_rels" USING btree ("reminders_id");
  CREATE INDEX "payload_locked_documents_rels_user_settings_id_idx" ON "payload_locked_documents_rels" USING btree ("user_settings_id");
  CREATE INDEX "payload_locked_documents_rels_ai_usages_id_idx" ON "payload_locked_documents_rels" USING btree ("ai_usages_id");
  CREATE INDEX "payload_locked_documents_rels_oauth_accounts_id_idx" ON "payload_locked_documents_rels" USING btree ("oauth_accounts_id");
  CREATE INDEX "payload_locked_documents_rels_payload_mcp_api_keys_id_idx" ON "payload_locked_documents_rels" USING btree ("payload_mcp_api_keys_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_preferences_rels_payload_mcp_api_keys_id_idx" ON "payload_preferences_rels" USING btree ("payload_mcp_api_keys_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");
  CREATE INDEX "app_settings_ai_models_order_idx" ON "app_settings_ai_models" USING btree ("_order");
  CREATE INDEX "app_settings_ai_models_parent_id_idx" ON "app_settings_ai_models" USING btree ("_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "users_sessions" CASCADE;
  DROP TABLE "users" CASCADE;
  DROP TABLE "media" CASCADE;
  DROP TABLE "accounts" CASCADE;
  DROP TABLE "people" CASCADE;
  DROP TABLE "categories" CASCADE;
  DROP TABLE "tags" CASCADE;
  DROP TABLE "transactions" CASCADE;
  DROP TABLE "transactions_rels" CASCADE;
  DROP TABLE "reminders_completed_dates" CASCADE;
  DROP TABLE "reminders" CASCADE;
  DROP TABLE "reminders_rels" CASCADE;
  DROP TABLE "user_settings" CASCADE;
  DROP TABLE "ai_usages" CASCADE;
  DROP TABLE "oauth_accounts" CASCADE;
  DROP TABLE "payload_mcp_api_keys" CASCADE;
  DROP TABLE "payload_kv" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TABLE "app_settings_ai_models" CASCADE;
  DROP TABLE "app_settings" CASCADE;
  DROP TYPE "public"."enum_users_role";
  DROP TYPE "public"."enum_media_type";
  DROP TYPE "public"."enum_media_entity_type";
  DROP TYPE "public"."enum_categories_type";
  DROP TYPE "public"."enum_transactions_type";
  DROP TYPE "public"."enum_reminders_type";
  DROP TYPE "public"."enum_reminders_recurrence_type";
  DROP TYPE "public"."enum_user_settings_theme";
  DROP TYPE "public"."enum_ai_usages_prompt_type";
  DROP TYPE "public"."enum_ai_usages_status";
  DROP TYPE "public"."enum_ai_usages_api_key_type";`)
}
