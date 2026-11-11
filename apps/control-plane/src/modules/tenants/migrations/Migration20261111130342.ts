import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261111130342 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "tenant" add column if not exists "storefront_url" text null;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "tenant" drop column if exists "storefront_url";`)
  }
}
