import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TYPE "public"."enum_ai_prompts_input_type" AS ENUM('text', 'image');

    CREATE TABLE "ai_prompts" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "user_id" uuid NOT NULL,
      "input_type" "enum_ai_prompts_input_type" NOT NULL,
      "input_text" varchar,
      "input_image_id" uuid,
      "system_prompt" varchar,
      "user_prompt" varchar,
      "model" varchar,
      "transaction_id" uuid,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    ALTER TABLE "ai_prompts" ADD CONSTRAINT "ai_prompts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "ai_prompts" ADD CONSTRAINT "ai_prompts_input_image_id_media_id_fk" FOREIGN KEY ("input_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "ai_prompts" ADD CONSTRAINT "ai_prompts_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE set null ON UPDATE no action;

    CREATE INDEX "ai_prompts_user_idx" ON "ai_prompts" USING btree ("user_id");
    CREATE INDEX "ai_prompts_input_image_idx" ON "ai_prompts" USING btree ("input_image_id");
    CREATE INDEX "ai_prompts_transaction_idx" ON "ai_prompts" USING btree ("transaction_id");
    CREATE INDEX "ai_prompts_created_at_idx" ON "ai_prompts" USING btree ("created_at");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE "ai_prompts";
    DROP TYPE "public"."enum_ai_prompts_input_type";
  `)
}
