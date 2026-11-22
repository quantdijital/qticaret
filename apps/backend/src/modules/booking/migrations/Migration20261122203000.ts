import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/**
 * A departure's cancellation terms as they stood when its booking was
 * confirmed (adr/0076 Ek D7a, review O5): `{ timezone, tiers }` copied
 * from the product. A cancel is reckoned by this copy; rows confirmed
 * before it (null) are reckoned by the product's settings at the cancel.
 */
export class Migration20261122203000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "booking_slot_use" add column if not exists "cancellation" jsonb null;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "booking_slot_use" drop column if exists "cancellation";`)
  }
}
