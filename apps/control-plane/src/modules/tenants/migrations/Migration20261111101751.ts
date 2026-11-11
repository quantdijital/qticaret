import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261111101751 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "tenant" add column if not exists "sector_pack_version" integer null, add column if not exists "sector_pack_applied_at" timestamptz null;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "tenant" drop column if exists "sector_pack_version", drop column if exists "sector_pack_applied_at";`
    )
  }
}
