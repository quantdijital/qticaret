import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261026043201 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "content_entry" drop constraint if exists "content_entry_kind_handle_unique";`
    )
    this.addSql(
      `create table if not exists "content_entry" ("id" text not null, "kind" text check ("kind" in ('page', 'post')) not null, "title" text not null, "handle" text not null, "status" text check ("status" in ('draft', 'published')) not null default 'draft', "body" jsonb not null, "body_summary" text not null default '', "word_count" integer not null default 0, "excerpt" text null, "author_name" text null, "image_url" text null, "image_alt" text null, "published_at" timestamptz null, "revised_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "content_entry_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_content_entry_deleted_at" ON "content_entry" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_content_entry_kind_handle_unique" ON "content_entry" ("kind", "handle") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_content_entry_kind_status_published_at" ON "content_entry" ("kind", "status", "published_at") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "content_entry" cascade;`)
  }
}
