import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261029122249 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "webhook_delivery" drop constraint if exists "webhook_delivery_subscription_id_event_id_unique";`
    )
    this.addSql(
      `alter table if exists "webhook_cursor" drop constraint if exists "webhook_cursor_name_unique";`
    )
    this.addSql(
      `create table if not exists "webhook_cursor" ("id" text not null, "name" text not null, "position" integer not null default 0, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "webhook_cursor_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_webhook_cursor_deleted_at" ON "webhook_cursor" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_webhook_cursor_name_unique" ON "webhook_cursor" ("name") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `create table if not exists "webhook_delivery" ("id" text not null, "subscription_id" text not null, "event" text not null, "event_id" text not null, "payload" jsonb not null, "status" text check ("status" in ('pending', 'delivered', 'stopped')) not null default 'pending', "attempts" integer not null default 0, "next_attempt_at" timestamptz not null, "last_status" integer null, "last_duration_ms" integer null, "last_error" text null, "delivered_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "webhook_delivery_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_webhook_delivery_deleted_at" ON "webhook_delivery" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_webhook_delivery_subscription_id_event_id_unique" ON "webhook_delivery" ("subscription_id", "event_id") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_webhook_delivery_status_next_attempt_at" ON "webhook_delivery" ("status", "next_attempt_at") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `create table if not exists "webhook_subscription" ("id" text not null, "url" text not null, "events" text[] not null, "secret_encrypted" text not null, "status" text check ("status" in ('active', 'disabled')) not null default 'active', "failure_streak" integer not null default 0, "disabled_at" timestamptz null, "created_by" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "webhook_subscription_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_webhook_subscription_deleted_at" ON "webhook_subscription" ("deleted_at") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "webhook_cursor" cascade;`)

    this.addSql(`drop table if exists "webhook_delivery" cascade;`)

    this.addSql(`drop table if exists "webhook_subscription" cascade;`)
  }
}
