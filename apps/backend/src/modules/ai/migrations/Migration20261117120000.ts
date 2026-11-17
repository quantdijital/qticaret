import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/**
 * adr/0071 §5 (PR 0b-3): the AI module's first tables. Written by hand
 * (no env in the agent's worktree) in the form `db:generate` gives;
 * `medusa db:generate ai` against it should report no changes.
 */
export class Migration20261117120000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table if not exists "ai_daily_usage" ("id" text not null, "day" text not null, "limit_group" text not null, "count" integer not null default 0, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "ai_daily_usage_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_ai_daily_usage_deleted_at" ON "ai_daily_usage" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_ai_daily_usage_day_limit_group_unique" ON "ai_daily_usage" ("day", "limit_group") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `create table if not exists "ai_preference" ("id" text not null, "user_id" text null, "task" text not null, "service" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "ai_preference_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_ai_preference_deleted_at" ON "ai_preference" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_ai_preference_user_task_unique" ON "ai_preference" ("user_id", "task") WHERE user_id IS NOT NULL AND deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_ai_preference_shop_task_unique" ON "ai_preference" ("task") WHERE user_id IS NULL AND deleted_at IS NULL;`
    )

    this.addSql(
      `create table if not exists "ai_usage" ("id" text not null, "task" text not null, "capability" text not null, "service" text not null, "model" text not null, "funding" text check ("funding" in ('own_key', 'platform_credit')) not null, "status" text check ("status" in ('succeeded', 'refused', 'failed', 'timeout', 'cancelled')) not null, "input_tokens" integer null, "output_tokens" integer null, "images" integer null, "seconds" integer null, "estimated_cost_micros" integer null, "currency" text null, "credits" integer null, "entity_type" text null, "entity_id" text null, "suggestion_id" text null, "job_id" text null, "duration_ms" integer null, "error_code" text null, "requested_by" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "ai_usage_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_ai_usage_deleted_at" ON "ai_usage" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_ai_usage_created_at" ON "ai_usage" ("created_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_ai_usage_task_created_at" ON "ai_usage" ("task", "created_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_ai_usage_service_created_at" ON "ai_usage" ("service", "created_at") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "ai_daily_usage" cascade;`)

    this.addSql(`drop table if exists "ai_preference" cascade;`)

    this.addSql(`drop table if exists "ai_usage" cascade;`)
  }
}
