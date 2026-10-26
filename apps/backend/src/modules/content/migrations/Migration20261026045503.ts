import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261026045503 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "landing_page" drop constraint if exists "landing_page_category_id_facet_kind_facet_key_facet_value_unique";`
    )
    this.addSql(
      `alter table if exists "landing_page" drop constraint if exists "landing_page_category_id_handle_unique";`
    )
    this.addSql(
      `create table if not exists "landing_page" ("id" text not null, "category_id" text not null, "facet_kind" text check ("facet_kind" in ('brand', 'attribute')) not null, "facet_key" text not null, "facet_value" text not null, "title" text not null, "handle" text not null, "status" text check ("status" in ('draft', 'published')) not null default 'draft', "body" jsonb not null, "body_summary" text not null default '', "word_count" integer not null default 0, "fingerprint_size" integer not null default 0, "fingerprint" jsonb not null, "originality" integer not null default 0, "reviewed_at" timestamptz null, "published_at" timestamptz null, "revised_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "landing_page_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_landing_page_deleted_at" ON "landing_page" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_landing_page_category_id_handle_unique" ON "landing_page" ("category_id", "handle") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_landing_page_category_id_facet_kind_facet_key_facet_value_unique" ON "landing_page" ("category_id", "facet_kind", "facet_key", "facet_value") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_landing_page_status_published_at" ON "landing_page" ("status", "published_at") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "landing_page" cascade;`)
  }
}
