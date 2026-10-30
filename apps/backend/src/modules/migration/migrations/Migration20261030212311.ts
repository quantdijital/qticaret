import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261030212311 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "migration_url" drop constraint if exists "migration_url_address_unique";`
    )
    this.addSql(
      `create table if not exists "migration_url" ("id" text not null, "address" text not null, "path" text not null, "query" text null, "origins" text[] not null, "clicks" integer null, "entity_type" text null, "entity_id" text null, "decision" text check ("decision" in ('auto', 'redirect', 'gone')) not null default 'auto', "target" text null, "decided_by" text null, "outcome" text null, "applied_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "migration_url_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_migration_url_deleted_at" ON "migration_url" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_migration_url_address_unique" ON "migration_url" ("address") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_migration_url_clicks" ON "migration_url" ("clicks") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "migration_url" cascade;`)
  }
}
