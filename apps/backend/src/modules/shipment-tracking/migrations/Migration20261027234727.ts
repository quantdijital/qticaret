import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261027234727 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "shipment_event" drop constraint if exists "shipment_event_shipment_id_status_unique";`
    )
    this.addSql(
      `alter table if exists "tracked_shipment" drop constraint if exists "tracked_shipment_provider_provider_shipment_id_unique";`
    )
    this.addSql(
      `alter table if exists "tracked_shipment" drop constraint if exists "tracked_shipment_fulfillment_id_unique";`
    )
    this.addSql(
      `create table if not exists "tracked_shipment" ("id" text not null, "fulfillment_id" text not null, "order_id" text not null, "provider" text not null, "provider_shipment_id" text not null, "tracking_number" text null, "tracking_url" text null, "status" text check ("status" in ('created', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'returned', 'failed', 'canceled')) not null default 'created', "status_at" timestamptz null, "test" boolean not null default false, "checked_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "tracked_shipment_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_tracked_shipment_deleted_at" ON "tracked_shipment" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_tracked_shipment_fulfillment_id_unique" ON "tracked_shipment" ("fulfillment_id") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_tracked_shipment_provider_provider_shipment_id_unique" ON "tracked_shipment" ("provider", "provider_shipment_id") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_tracked_shipment_status_checked_at" ON "tracked_shipment" ("status", "checked_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_tracked_shipment_order_id" ON "tracked_shipment" ("order_id") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `create table if not exists "shipment_event" ("id" text not null, "shipment_id" text not null, "status" text check ("status" in ('created', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'returned', 'failed', 'canceled')) not null, "occurred_at" timestamptz not null, "provider_status" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "shipment_event_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_shipment_event_shipment_id" ON "shipment_event" ("shipment_id") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_shipment_event_deleted_at" ON "shipment_event" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_shipment_event_shipment_id_status_unique" ON "shipment_event" ("shipment_id", "status") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `alter table if exists "shipment_event" add constraint "shipment_event_shipment_id_foreign" foreign key ("shipment_id") references "tracked_shipment" ("id") on update cascade;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "shipment_event" drop constraint if exists "shipment_event_shipment_id_foreign";`
    )

    this.addSql(`drop table if exists "tracked_shipment" cascade;`)

    this.addSql(`drop table if exists "shipment_event" cascade;`)
  }
}
