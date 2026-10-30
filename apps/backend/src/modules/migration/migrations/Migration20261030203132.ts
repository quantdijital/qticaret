import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261030203132 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "migration_item" drop constraint if exists "migration_item_source_kind_source_key_unique";`
    )
    this.addSql(
      `alter table if exists "legacy_order" drop constraint if exists "legacy_order_source_source_key_unique";`
    )
    this.addSql(
      `create table if not exists "legacy_order" ("id" text not null, "source" text not null, "source_key" text not null, "number" text not null, "placed_at" timestamptz not null, "currency_code" text not null, "total" numeric not null, "status" text not null, "customer_id" text null, "email" text null, "lines" jsonb not null default '{}', "raw_total" jsonb not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "legacy_order_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_legacy_order_deleted_at" ON "legacy_order" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_legacy_order_source_source_key_unique" ON "legacy_order" ("source", "source_key") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_legacy_order_customer_id" ON "legacy_order" ("customer_id") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `create table if not exists "migration_item" ("id" text not null, "source" text not null, "kind" text not null, "source_key" text not null, "target_id" text null, "status" text check ("status" in ('done', 'skipped', 'failed')) not null, "error_code" text null, "old_url" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "migration_item_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_migration_item_deleted_at" ON "migration_item" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_migration_item_source_kind_source_key_unique" ON "migration_item" ("source", "kind", "source_key") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_migration_item_source_kind_status" ON "migration_item" ("source", "kind", "status") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `create table if not exists "migration_run" ("id" text not null, "source" text not null, "mode" text check ("mode" in ('check', 'apply')) not null, "status" text check ("status" in ('running', 'done', 'failed')) not null default 'running', "job_id" text null, "started_by" text null, "counts" jsonb not null default '{}', "finished_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "migration_run_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_migration_run_deleted_at" ON "migration_run" ("deleted_at") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "legacy_order" cascade;`)

    this.addSql(`drop table if exists "migration_item" cascade;`)

    this.addSql(`drop table if exists "migration_run" cascade;`)
  }
}
