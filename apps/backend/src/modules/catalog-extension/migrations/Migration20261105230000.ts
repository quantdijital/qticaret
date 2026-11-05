import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261105230000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "product_extension" add column if not exists "summary" text[] null;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "product_extension" drop column if exists "summary";`)
  }
}
