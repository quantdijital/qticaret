import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261030120822 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "product_extension" add column if not exists "withdrawal_excluded" boolean not null default false;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "product_extension" drop column if exists "withdrawal_excluded";`
    )
  }
}
