import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261025164059 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table if not exists "product_extension" ("id" text not null, "condition" text check ("condition" in ('new', 'refurbished', 'used', 'damaged')) not null default 'new', "kind" text check ("kind" in ('physical', 'digital', 'service')) not null default 'physical', "primary_category_id" text null, "successor_product_id" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "product_extension_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_product_extension_deleted_at" ON "product_extension" ("deleted_at") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `create table if not exists "variant_extension" ("id" text not null, "mpn" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "variant_extension_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_variant_extension_deleted_at" ON "variant_extension" ("deleted_at") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "product_extension" cascade;`)

    this.addSql(`drop table if exists "variant_extension" cascade;`)
  }
}
