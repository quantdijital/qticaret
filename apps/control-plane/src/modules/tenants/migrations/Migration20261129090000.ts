import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/** The wizard's "Örnek ürünlerle başla": asked for, and when the shop loaded it. */
export class Migration20261129090000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "tenant" add column if not exists "sample_catalog" boolean not null default false, add column if not exists "sample_catalog_loaded_at" timestamptz null;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "tenant" drop column if exists "sample_catalog", drop column if exists "sample_catalog_loaded_at";`
    )
  }
}
