import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/**
 * The booking module's tables (adr/0076 §3), empty until a shop sells a
 * dated product. The slot's checks keep its counters inside the capacity
 * (`sold + held <= capacity`, neither below zero) whatever runs at once.
 */
export class Migration20261122022938 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "booking_slot_use" drop constraint if exists "booking_slot_use_booking_id_slot_id_unique";`
    )
    this.addSql(
      `alter table if exists "booking_hold_slot" drop constraint if exists "booking_hold_slot_hold_id_slot_id_unique";`
    )
    this.addSql(
      `alter table if exists "booking_hold" drop constraint if exists "booking_hold_cart_id_unique";`
    )
    this.addSql(
      `alter table if exists "booking" drop constraint if exists "booking_hold_id_unique";`
    )
    this.addSql(
      `alter table if exists "bookable" drop constraint if exists "bookable_product_id_unique";`
    )
    this.addSql(
      `create table if not exists "bookable" ("id" text not null, "product_id" text not null, "mode" text check ("mode" in ('departure', 'range')) not null default 'departure', "cutoff_hours" integer not null default 0, "hold_minutes" integer not null default 20, "max_units_per_cart" integer not null default 20, "min_participants" integer null, "traveler_fields" jsonb null, "cancellation_tiers" jsonb null, "pax_by_variant" jsonb null, "timezone" text not null default 'Europe/Istanbul', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "bookable_pkey" primary key ("id"), constraint bookable_hold_minutes_check check (hold_minutes BETWEEN 10 AND 60), constraint bookable_cutoff_hours_check check (cutoff_hours >= 0), constraint bookable_max_units_check check (max_units_per_cart >= 1));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_bookable_deleted_at" ON "bookable" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_bookable_product_id_unique" ON "bookable" ("product_id") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `create table if not exists "booking" ("id" text not null, "order_id" text not null, "line_item_id" text null, "hold_id" text not null, "status" text check ("status" in ('confirmed', 'cancelled', 'completed')) not null default 'confirmed', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "booking_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_booking_deleted_at" ON "booking" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_booking_hold_id_unique" ON "booking" ("hold_id") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_booking_order_id" ON "booking" ("order_id") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `create table if not exists "booking_hold" ("id" text not null, "cart_id" text not null, "expires_at" timestamptz not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "booking_hold_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_booking_hold_deleted_at" ON "booking_hold" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_booking_hold_cart_id_unique" ON "booking_hold" ("cart_id") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_booking_hold_expires_at" ON "booking_hold" ("expires_at") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `create table if not exists "booking_hold_slot" ("id" text not null, "hold_id" text not null, "slot_id" text not null, "units" integer not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "booking_hold_slot_pkey" primary key ("id"), constraint booking_hold_slot_units_check check (units > 0));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_booking_hold_slot_deleted_at" ON "booking_hold_slot" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_booking_hold_slot_hold_id_slot_id_unique" ON "booking_hold_slot" ("hold_id", "slot_id") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_booking_hold_slot_slot_id" ON "booking_hold_slot" ("slot_id") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `create table if not exists "booking_slot" ("id" text not null, "bookable_id" text not null, "starts_at" timestamptz not null, "ends_at" timestamptz null, "capacity" integer not null, "sold" integer not null default 0, "held" integer not null default 0, "status" text check ("status" in ('open', 'closed', 'cancelled')) not null default 'open', "price_adjustments" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "booking_slot_pkey" primary key ("id"), constraint booking_slot_counts_check check (sold + held <= capacity), constraint booking_slot_nonnegative_check check (sold >= 0 AND held >= 0));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_booking_slot_deleted_at" ON "booking_slot" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_booking_slot_bookable_id_starts_at" ON "booking_slot" ("bookable_id", "starts_at") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `create table if not exists "booking_slot_use" ("id" text not null, "booking_id" text not null, "slot_id" text not null, "units" integer not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "booking_slot_use_pkey" primary key ("id"), constraint booking_slot_use_units_check check (units > 0));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_booking_slot_use_deleted_at" ON "booking_slot_use" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_booking_slot_use_booking_id_slot_id_unique" ON "booking_slot_use" ("booking_id", "slot_id") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_booking_slot_use_slot_id" ON "booking_slot_use" ("slot_id") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "bookable" cascade;`)

    this.addSql(`drop table if exists "booking" cascade;`)

    this.addSql(`drop table if exists "booking_hold" cascade;`)

    this.addSql(`drop table if exists "booking_hold_slot" cascade;`)

    this.addSql(`drop table if exists "booking_slot" cascade;`)

    this.addSql(`drop table if exists "booking_slot_use" cascade;`)
  }
}
