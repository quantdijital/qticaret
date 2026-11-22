import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/**
 * Refund safety follow-up of adr/0076: `booking_slot_use.cancel_refund`,
 * how a departure's cancel gave its money back (`sent`, `none`, or left
 * to staff: `offline`, `credit`, `exceeds`), written with `cancelled_at`.
 * A cancel asked again and the reconcile's bell read it. Nullable: rows
 * cancelled before keep null and are judged as before. Down drops it; the
 * bell then guesses from the order again.
 */
export class Migration20261123030000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "booking_slot_use" add column if not exists "cancel_refund" text null;`
    )
    this.addSql(
      `alter table if exists "booking_slot_use" add constraint "booking_slot_use_cancel_refund_check" check ("cancel_refund" in ('sent', 'none', 'offline', 'credit', 'exceeds'));`
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "booking_slot_use" drop constraint if exists "booking_slot_use_cancel_refund_check";`
    )
    this.addSql(`alter table if exists "booking_slot_use" drop column if exists "cancel_refund";`)
  }
}
