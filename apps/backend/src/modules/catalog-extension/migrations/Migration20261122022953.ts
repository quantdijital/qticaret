import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/**
 * A product's booking mode (adr/0076 §2): `none` for every product there
 * is, so nothing changes until a shop sets one under `catalog.booking`.
 */
export class Migration20261122022953 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "product_extension" add column if not exists "booking_mode" text check ("booking_mode" in ('none', 'departure', 'range')) not null default 'none';`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "product_extension" drop column if exists "booking_mode";`)
  }
}
