import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/**
 * Travelers on a departure (adr/0076 §7, D6): names, birth dates and
 * nationalities plain; an ID or passport number only sealed, hashed and
 * its last four. A new table; nothing existing changes.
 */
export class Migration20261122095448 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "booking_traveler" drop constraint if exists "booking_traveler_cart_id_slot_id_position_unique";`
    )
    this.addSql(
      `create table if not exists "booking_traveler" ("id" text not null, "cart_id" text not null, "slot_id" text not null, "booking_id" text null, "position" integer not null, "first_name" text not null, "last_name" text not null, "birth_date" text null, "nationality" text null, "document_encrypted" text null, "document_hash" text null, "document_last4" text null, "key_version" integer null, "purge_after" timestamptz not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "booking_traveler_pkey" primary key ("id"), constraint booking_traveler_position_check check (position >= 0));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_booking_traveler_deleted_at" ON "booking_traveler" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_booking_traveler_cart_id_slot_id_position_unique" ON "booking_traveler" ("cart_id", "slot_id", "position") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_booking_traveler_booking_id" ON "booking_traveler" ("booking_id") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_booking_traveler_slot_id" ON "booking_traveler" ("slot_id") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_booking_traveler_purge_after" ON "booking_traveler" ("purge_after") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_booking_traveler_document_hash" ON "booking_traveler" ("document_hash") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "booking_traveler" cascade;`)
  }
}
