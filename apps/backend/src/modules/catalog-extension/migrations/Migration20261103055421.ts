import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261103055421 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "product_extension" add column if not exists "addons" jsonb null;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "product_extension" drop column if exists "addons";`)
  }
}
