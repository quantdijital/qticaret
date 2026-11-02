import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261102180339 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "storefront_layout_revision" drop constraint if exists "storefront_layout_revision_revision_unique";`
    )
    this.addSql(
      `create table if not exists "storefront_layout" ("id" text not null, "draft" jsonb not null, "published" jsonb null, "published_at" timestamptz null, "published_by" text null, "revision" integer not null default 0, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "storefront_layout_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_storefront_layout_deleted_at" ON "storefront_layout" ("deleted_at") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `create table if not exists "storefront_layout_revision" ("id" text not null, "revision" integer not null, "document" jsonb not null, "published_at" timestamptz not null, "published_by" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "storefront_layout_revision_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_storefront_layout_revision_deleted_at" ON "storefront_layout_revision" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_storefront_layout_revision_revision_unique" ON "storefront_layout_revision" ("revision") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "storefront_layout" cascade;`)

    this.addSql(`drop table if exists "storefront_layout_revision" cascade;`)
  }
}
