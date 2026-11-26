import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/**
 * The most of a product one order may hold (S5, WooCommerce's "sold
 * individually" and max quantity): checked as lines are added or changed
 * and once more at checkout. Null for every product there is, so nothing
 * changes until a shop sets one.
 */
export class Migration20261126130000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "product_extension" add column if not exists "max_quantity" integer null;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "product_extension" drop column if exists "max_quantity";`)
  }
}
