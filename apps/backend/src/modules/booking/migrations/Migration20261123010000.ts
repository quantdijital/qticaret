import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/**
 * A booking's messages (adr/0076 Ek D7b):
 * - `bookable.reminder_days`: the reminder goes this many days before a
 *   departure (0: none); existing products take the default, 2;
 * - `booking.voucher_code`: the voucher's check code, made on first read,
 *   unique among live bookings (80 random bits, never personal data);
 * - `booking_slot_use.reminded_at`: the departure's reminder went out.
 * Down drops the three; vouchers already sent stop checking.
 */
export class Migration20261123010000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "bookable" add column if not exists "reminder_days" integer not null default 2;`
    )
    this.addSql(
      `alter table if exists "bookable" add constraint "bookable_reminder_days_check" check (reminder_days BETWEEN 0 AND 30);`
    )
    this.addSql(
      `alter table if exists "booking" add column if not exists "voucher_code" text null;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_booking_voucher_code_unique" ON "booking" ("voucher_code") WHERE voucher_code IS NOT NULL AND deleted_at IS NULL;`
    )
    this.addSql(
      `alter table if exists "booking_slot_use" add column if not exists "reminded_at" timestamptz null;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "booking_slot_use" drop column if exists "reminded_at";`)
    this.addSql(`DROP INDEX IF EXISTS "IDX_booking_voucher_code_unique";`)
    this.addSql(`alter table if exists "booking" drop column if exists "voucher_code";`)
    this.addSql(
      `alter table if exists "bookable" drop constraint if exists "bookable_reminder_days_check";`
    )
    this.addSql(`alter table if exists "bookable" drop column if exists "reminder_days";`)
  }
}
