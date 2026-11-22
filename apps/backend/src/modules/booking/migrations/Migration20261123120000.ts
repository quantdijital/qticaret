import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/**
 * Departures found by their dates across products (adr/0077 §3, search
 * and cards): a partial index on the open, live departures' start, so a
 * date search reads only the departures in its days. Down drops it.
 */
export class Migration20261123120000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_booking_slot_open_starts_at" ON "booking_slot" ("starts_at") WHERE status = 'open' AND deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "IDX_booking_slot_open_starts_at";`)
  }
}
