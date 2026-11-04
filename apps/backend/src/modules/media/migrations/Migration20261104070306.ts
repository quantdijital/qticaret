import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261104070306 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "media_asset" add column if not exists "filename" text null, add column if not exists "mime_type" text null, add column if not exists "size" integer null, add column if not exists "uploaded_by" text null, add column if not exists "in_library" boolean not null default false;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_media_asset_created_at" ON "media_asset" ("created_at") WHERE deleted_at IS NULL AND file_id IS NOT NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "IDX_media_asset_created_at";`)
    this.addSql(
      `alter table if exists "media_asset" drop column if exists "filename", drop column if exists "mime_type", drop column if exists "size", drop column if exists "uploaded_by", drop column if exists "in_library";`
    )
  }
}
