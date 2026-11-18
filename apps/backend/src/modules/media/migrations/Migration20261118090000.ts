import { Migration } from "@medusajs/framework/mikro-orm/migrations"

// adr/0071 §5 (Aşama 4): an AI made picture says so and names the picture it came from
export class Migration20261118090000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "media_asset" add column if not exists "ai_source" text check ("ai_source" in ('edited', 'generated')) null, add column if not exists "derived_from_id" text null;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_media_asset_derived_from_id" ON "media_asset" ("derived_from_id") WHERE deleted_at IS NULL AND derived_from_id IS NOT NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "IDX_media_asset_derived_from_id";`)
    this.addSql(
      `alter table if exists "media_asset" drop column if exists "ai_source", drop column if exists "derived_from_id";`
    )
  }
}
