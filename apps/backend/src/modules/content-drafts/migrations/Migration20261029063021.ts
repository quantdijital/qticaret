import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261029063021 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "draft_usage" drop constraint if exists "draft_usage_month_unique";`
    )
    this.addSql(
      `create table if not exists "content_draft" ("id" text not null, "entity_type" text not null, "entity_id" text not null, "kind" text not null, "text" text not null, "prompt" text not null, "provider" text not null, "source" text not null default 'ai_draft', "status" text check ("status" in ('draft', 'approved', 'rejected', 'refused')) not null, "problems" jsonb null, "created_by" text not null, "decided_by" text null, "decided_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "content_draft_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_content_draft_deleted_at" ON "content_draft" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_content_draft_entity_type_entity_id" ON "content_draft" ("entity_type", "entity_id") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `create table if not exists "draft_usage" ("id" text not null, "month" text not null, "count" integer not null default 0, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "draft_usage_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_draft_usage_deleted_at" ON "draft_usage" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_draft_usage_month_unique" ON "draft_usage" ("month") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "content_draft" cascade;`)

    this.addSql(`drop table if exists "draft_usage" cascade;`)
  }
}
