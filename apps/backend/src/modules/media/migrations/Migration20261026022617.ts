import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261026022617 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "media_asset" drop constraint if exists "media_asset_url_unique";`
    )
    this.addSql(
      `create table if not exists "media_asset" ("id" text not null, "file_id" text null, "url" text not null, "width" integer null, "height" integer null, "alt" text null, "derived_for" text null, "derivatives" jsonb null, "derivative_file_ids" text[] null, "derived_at" timestamptz null, "attached_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "media_asset_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_media_asset_deleted_at" ON "media_asset" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_media_asset_url_unique" ON "media_asset" ("url") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_media_asset_file_id" ON "media_asset" ("file_id") WHERE deleted_at IS NULL AND file_id IS NOT NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "media_asset" cascade;`)
  }
}
