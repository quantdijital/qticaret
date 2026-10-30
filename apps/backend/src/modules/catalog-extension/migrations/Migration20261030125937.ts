import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261030125937 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table if not exists "category_restriction" ("id" text not null, "category_id" text not null, "restriction" text check ("restriction" in ('weapon', 'alcohol', 'tobacco', 'adult_content', 'other')) not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "category_restriction_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_category_restriction_deleted_at" ON "category_restriction" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_category_restriction_category" ON "category_restriction" ("category_id") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `alter table if exists "product_extension" add column if not exists "restriction" text check ("restriction" in ('weapon', 'alcohol', 'tobacco', 'adult_content', 'other')) null;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "category_restriction" cascade;`)

    this.addSql(`alter table if exists "product_extension" drop column if exists "restriction";`)
  }
}
