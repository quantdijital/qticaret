import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261102210437 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "product_extension" add column if not exists "is_gift_card" boolean not null default false;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "product_extension" drop column if exists "is_gift_card";`)
  }
}
