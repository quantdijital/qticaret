import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261027143106 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "webhook_event" drop constraint if exists "webhook_event_provider_event_key_unique";`
    )
    this.addSql(
      `create table if not exists "webhook_event" ("id" text not null, "provider" text not null, "event_key" text not null, "status" text check ("status" in ('processing', 'processed', 'failed')) not null default 'processing', "attempts" integer not null default 1, "summary" jsonb null, "error_code" text null, "processed_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "webhook_event_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_webhook_event_deleted_at" ON "webhook_event" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_webhook_event_provider_event_key_unique" ON "webhook_event" ("provider", "event_key") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_webhook_event_created_at" ON "webhook_event" ("created_at") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "webhook_event" cascade;`)
  }
}
