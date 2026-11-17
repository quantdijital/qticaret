import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261116220159 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "storefront_design" drop constraint if exists "storefront_design_name_key_unique";`
    )
    this.addSql(
      `create table if not exists "storefront_design" ("id" text not null, "kind" text check ("kind" in ('saved', 'auto')) not null, "name" text null, "name_key" text null, "document" jsonb not null, "digest" text not null, "summary" jsonb not null, "created_by" text null, "applied_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "storefront_design_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_storefront_design_deleted_at" ON "storefront_design" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_storefront_design_name_key_unique" ON "storefront_design" ("name_key") WHERE kind = 'saved' AND deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_storefront_design_digest" ON "storefront_design" ("digest") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "storefront_design" cascade;`)
  }
}
