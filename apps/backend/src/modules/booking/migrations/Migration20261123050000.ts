import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/**
 * How a dated product is sold (adr/0076 Ek 2026-11-23): `bookable.sale_mode`
 * is `online` (the cart, today's way), `request` (a call-me request only)
 * or `both`. Existing products take `online`; down drops the column and
 * every product sells online again.
 */
export class Migration20261123050000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "bookable" add column if not exists "sale_mode" text check ("sale_mode" in ('online', 'request', 'both')) not null default 'online';`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "bookable" drop column if exists "sale_mode";`)
  }
}
