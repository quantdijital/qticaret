import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/** A collection's text, picture and visibility (Ürünler > Koleksiyonlar). */
export class Migration20261110120000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table if not exists "collection_extension" ("id" text not null, "description" text null, "is_active" boolean not null default true, "image_url" text null, "image_alt" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "collection_extension_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_collection_extension_deleted_at" ON "collection_extension" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_collection_extension_image_url" ON "collection_extension" ("image_url") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "collection_extension" cascade;`)
  }
}
