import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/**
 * A contact message's phone as a keyed hash (adr/0076 Ek 2026-11-23, O1):
 * a booking request may come with a phone only, and a KVKK request must
 * find it. Messages kept before this have none (their address finds them).
 * Down drops the column; the phones stay in the sealed content.
 */
export class Migration20261123060000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "contact_message" add column if not exists "phone_hash" text null;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_contact_message_phone_hash" ON "contact_message" ("phone_hash") WHERE phone_hash IS NOT NULL AND deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`DROP INDEX IF EXISTS "IDX_contact_message_phone_hash";`)
    this.addSql(`alter table if exists "contact_message" drop column if exists "phone_hash";`)
  }
}
