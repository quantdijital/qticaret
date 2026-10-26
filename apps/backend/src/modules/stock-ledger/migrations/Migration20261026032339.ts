import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261026032339 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "stock_watch" drop constraint if exists "stock_watch_inventory_item_id_unique";`
    )
    this.addSql(
      `create table if not exists "stock_movement" ("id" text not null, "seq" serial, "inventory_item_id" text not null, "location_id" text not null, "delta_stocked" integer not null, "stocked_after" integer not null, "delta_reserved" integer not null, "reserved_after" integer not null, "reason" text check ("reason" in ('manual', 'import', 'bulk_edit', 'order', 'return', 'cancel', 'reconcile', 'unknown')) not null, "reference" text null, "actor_id" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "stock_movement_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_stock_movement_deleted_at" ON "stock_movement" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_stock_movement_inventory_item_id_location_id_seq" ON "stock_movement" ("inventory_item_id", "location_id", "seq") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_stock_movement_inventory_item_id_seq" ON "stock_movement" ("inventory_item_id", "seq") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `create table if not exists "stock_watch" ("id" text not null, "inventory_item_id" text not null, "threshold" integer null, "armed_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "stock_watch_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_stock_watch_deleted_at" ON "stock_watch" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_stock_watch_inventory_item_id_unique" ON "stock_watch" ("inventory_item_id") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "stock_movement" cascade;`)

    this.addSql(`drop table if exists "stock_watch" cascade;`)
  }
}
