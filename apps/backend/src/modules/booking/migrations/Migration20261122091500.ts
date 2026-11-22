import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/**
 * A hold's shopper as a keyed hash of the address (adr/0076 Ek takip M1):
 * one address's live holds are capped. Existing holds have none and are
 * not counted; the value goes with the hold (at most 120 minutes).
 */
export class Migration20261122091500 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "booking_hold" add column if not exists "client_hash" text null;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_booking_hold_client_hash" ON "booking_hold" ("client_hash") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "IDX_booking_hold_client_hash";`)
    this.addSql(`alter table if exists "booking_hold" drop column if exists "client_hash";`)
  }
}
