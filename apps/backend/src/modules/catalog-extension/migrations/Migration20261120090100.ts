import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/**
 * Category and collection descriptions as content documents (adr/0075): a
 * category's in its own row by the category's id, a collection's beside
 * its plain text. The plain `description` columns keep the text.
 */
export class Migration20261120090100 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table if not exists "category_extension" ("id" text not null, "category_id" text not null, "description_doc" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "category_extension_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_category_extension_deleted_at" ON "category_extension" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_category_extension_category" ON "category_extension" ("category_id") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `alter table if exists "collection_extension" add column if not exists "description_doc" jsonb null;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "collection_extension" drop column if exists "description_doc";`
    )
    this.addSql(`drop table if exists "category_extension" cascade;`)
  }
}
