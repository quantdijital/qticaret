import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/**
 * A product's linked products (S3): better or similar ones for its page
 * and ones bought with it for the cart, each an ordered list of product
 * ids. Null for every product there is: nothing changes until a shop
 * links some.
 */
export class Migration20261126180000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "product_extension" add column if not exists "upsell_product_ids" text[] null, add column if not exists "cross_sell_product_ids" text[] null;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "product_extension" drop column if exists "upsell_product_ids", drop column if exists "cross_sell_product_ids";`
    )
  }
}
