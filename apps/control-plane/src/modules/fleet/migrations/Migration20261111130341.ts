import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261111130341 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "usage_snapshot" drop constraint if exists "usage_snapshot_tenant_id_reported_at_unique";`
    )
    this.addSql(
      `alter table if exists "health_standing" drop constraint if exists "health_standing_tenant_id_target_unique";`
    )
    this.addSql(
      `create table if not exists "health_check" ("id" text not null, "tenant_id" text not null, "target" text check ("target" in ('backend', 'storefront')) not null, "checked_at" timestamptz not null, "ok" boolean not null, "status_code" integer null, "latency_ms" integer null, "error" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "health_check_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_health_check_deleted_at" ON "health_check" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_health_check_tenant_id_target_checked_at" ON "health_check" ("tenant_id", "target", "checked_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_health_check_checked_at" ON "health_check" ("checked_at") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `create table if not exists "health_standing" ("id" text not null, "tenant_id" text not null, "target" text check ("target" in ('backend', 'storefront')) not null, "state" text check ("state" in ('healthy', 'failing', 'unhealthy')) not null, "consecutive_failures" integer not null default 0, "checked_at" timestamptz not null, "last_ok_at" timestamptz null, "unhealthy_since" timestamptz null, "status_code" integer null, "latency_ms" integer null, "error" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "health_standing_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_health_standing_deleted_at" ON "health_standing" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_health_standing_tenant_id_target_unique" ON "health_standing" ("tenant_id", "target") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `create table if not exists "usage_snapshot" ("id" text not null, "tenant_id" text not null, "reported_at" timestamptz not null, "received_at" timestamptz not null, "period" text not null, "products" integer not null, "orders_this_month" integer not null, "staff" integer not null, "storage_mb" integer not null, "llm_credits_this_month" integer not null, "last_order_at" timestamptz null, "release_version" text not null, "release_commit" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "usage_snapshot_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_usage_snapshot_deleted_at" ON "usage_snapshot" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_usage_snapshot_tenant_id_reported_at_unique" ON "usage_snapshot" ("tenant_id", "reported_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_usage_snapshot_reported_at" ON "usage_snapshot" ("reported_at") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "health_check" cascade;`)

    this.addSql(`drop table if exists "health_standing" cascade;`)

    this.addSql(`drop table if exists "usage_snapshot" cascade;`)
  }
}
