import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261102175016 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "storefront_menu" drop constraint if exists "storefront_menu_location_unique";`
    )
    this.addSql(
      `create table if not exists "storefront_menu" ("id" text not null, "title" text not null, "location" text check ("location" in ('main', 'top', 'footer')) not null, "rank" integer not null default 0, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "storefront_menu_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_storefront_menu_deleted_at" ON "storefront_menu" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_storefront_menu_location_unique" ON "storefront_menu" ("location") WHERE location IN ('main', 'top') AND deleted_at IS NULL;`
    )

    this.addSql(
      `create table if not exists "storefront_menu_item" ("id" text not null, "menu_id" text not null, "parent_id" text null, "rank" integer not null default 0, "label" text null, "kind" text check ("kind" in ('category', 'product', 'collection', 'brand', 'page', 'post', 'landing', 'legal', 'system', 'url')) not null, "target" text null, "url" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "storefront_menu_item_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_storefront_menu_item_menu_id" ON "storefront_menu_item" ("menu_id") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_storefront_menu_item_deleted_at" ON "storefront_menu_item" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_storefront_menu_item_menu_id_parent_id_rank" ON "storefront_menu_item" ("menu_id", "parent_id", "rank") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `alter table if exists "storefront_menu_item" add constraint "storefront_menu_item_menu_id_foreign" foreign key ("menu_id") references "storefront_menu" ("id") on update cascade on delete cascade;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "storefront_menu_item" drop constraint if exists "storefront_menu_item_menu_id_foreign";`
    )

    this.addSql(`drop table if exists "storefront_menu" cascade;`)

    this.addSql(`drop table if exists "storefront_menu_item" cascade;`)
  }
}
