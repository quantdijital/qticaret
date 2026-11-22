import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/**
 * A dated product's call-me request (adr/0076 Ek 2026-11-23) is a contact
 * message of subject `booking`:
 * - `product_id`, `details` (`{ slot_id?, date?, month?, adults, children? }`):
 *   what is asked for, no person's data;
 * - `email_hash` may be empty: such a request needs a phone, not an address.
 * Down removes booking requests first (they would break the subject's check
 * and the address's), then the columns.
 */
export class Migration20261123050100 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "contact_message" add column if not exists "product_id" text null, add column if not exists "details" jsonb null;`
    )
    this.addSql(`alter table if exists "contact_message" alter column "email_hash" drop not null;`)
    this.addSql(
      `alter table if exists "contact_message" drop constraint if exists "contact_message_subject_check";`
    )
    this.addSql(
      `alter table if exists "contact_message" add constraint "contact_message_subject_check" check("subject" in ('order', 'product', 'return', 'payment', 'kvkk', 'booking', 'other'));`
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `delete from "contact_message" where "subject" = 'booking' or "email_hash" is null;`
    )
    this.addSql(
      `alter table if exists "contact_message" drop constraint if exists "contact_message_subject_check";`
    )
    this.addSql(
      `alter table if exists "contact_message" add constraint "contact_message_subject_check" check("subject" in ('order', 'product', 'return', 'payment', 'kvkk', 'other'));`
    )
    this.addSql(`alter table if exists "contact_message" alter column "email_hash" set not null;`)
    this.addSql(
      `alter table if exists "contact_message" drop column if exists "details", drop column if exists "product_id";`
    )
  }
}
