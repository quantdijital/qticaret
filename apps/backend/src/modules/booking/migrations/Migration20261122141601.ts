import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/**
 * One departure of a booking cancelled on its own (adr/0076 Ek D7a): the
 * use row keeps when, its places gone back to the slot. Existing rows are
 * live (null); a booking cancelled whole before this keeps its status.
 *
 * Down: safe only while no departure was cancelled on its own. Once one
 * was, dropping `cancelled_at` makes that departure live again in the
 * counters' eyes (its places given back, its money refunded), so a
 * booking cancelled in part must be settled by hand before rolling back.
 */
export class Migration20261122141601 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "booking_slot_use" add column if not exists "cancelled_at" timestamptz null;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "booking_slot_use" drop column if exists "cancelled_at";`)
  }
}
