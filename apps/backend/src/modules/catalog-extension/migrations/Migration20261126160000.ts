import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/**
 * A product's shipping class (adr/0087 §1): `free`, or one of the shop's
 * own classes with a surcharge. Null for every product there is: Standard,
 * so nothing changes until a shop picks one.
 */
export class Migration20261126160000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "product_extension" add column if not exists "shipping_class" text null;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "product_extension" drop column if exists "shipping_class";`)
  }
}
