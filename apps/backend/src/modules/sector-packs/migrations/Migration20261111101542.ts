import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261111101542 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "sector_pack_item" drop constraint if exists "sector_pack_item_pack_key_unique";`
    )
    this.addSql(
      `alter table if exists "sector_pack_application" drop constraint if exists "sector_pack_application_pack_unique";`
    )
    this.addSql(
      `create table if not exists "sector_pack_application" ("id" text not null, "pack" text not null, "version" integer not null, "applied_at" timestamptz not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "sector_pack_application_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_sector_pack_application_pack_unique" ON "sector_pack_application" ("pack") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_sector_pack_application_deleted_at" ON "sector_pack_application" ("deleted_at") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `create table if not exists "sector_pack_item" ("id" text not null, "pack" text not null, "key" text not null, "kind" text check ("kind" in ('attribute_template', 'attribute', 'category', 'flag', 'seo_template')) not null, "outcome" text check ("outcome" in ('added', 'kept', 'skipped')) not null, "version" integer not null, "record_id" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "sector_pack_item_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_sector_pack_item_deleted_at" ON "sector_pack_item" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_sector_pack_item_pack_key_unique" ON "sector_pack_item" ("pack", "key") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "sector_pack_application" cascade;`)

    this.addSql(`drop table if exists "sector_pack_item" cascade;`)
  }
}
