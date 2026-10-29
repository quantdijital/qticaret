import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261029115427 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "accounting_sync" drop constraint if exists "accounting_sync_source_type_source_id_adapter_unique";`
    )
    this.addSql(
      `create table if not exists "accounting_sync" ("id" text not null, "adapter" text not null, "source_type" text check ("source_type" in ('sale', 'payment', 'refund')) not null, "source_id" text not null, "status" text check ("status" in ('pending', 'synced', 'stopped')) not null default 'pending', "attempts" integer not null default 0, "next_attempt_at" timestamptz not null, "external_ref" text null, "last_error" text null, "synced_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "accounting_sync_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_accounting_sync_deleted_at" ON "accounting_sync" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_accounting_sync_source_type_source_id_adapter_unique" ON "accounting_sync" ("source_type", "source_id", "adapter") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_accounting_sync_status_next_attempt_at" ON "accounting_sync" ("status", "next_attempt_at") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "accounting_sync" cascade;`)
  }
}
