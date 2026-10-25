import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261025234705 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "sitemap_state" add column if not exists "indexnow_key" text null, add column if not exists "indexnow_pinged_at" timestamptz null;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "sitemap_state" drop column if exists "indexnow_key", drop column if exists "indexnow_pinged_at";`
    )
  }
}
