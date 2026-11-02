import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261102203606 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "content_term" drop constraint if exists "content_term_kind_handle_unique";`
    )
    this.addSql(
      `alter table if exists "content_entry_term" drop constraint if exists "content_entry_term_entry_id_unique";`
    )
    this.addSql(
      `alter table if exists "content_entry_term" drop constraint if exists "content_entry_term_entry_id_term_id_unique";`
    )
    this.addSql(
      `create table if not exists "content_entry_term" ("id" text not null, "entry_id" text not null, "term_id" text not null, "term_kind" text check ("term_kind" in ('category', 'tag')) not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "content_entry_term_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_content_entry_term_deleted_at" ON "content_entry_term" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_content_entry_term_entry_id_term_id_unique" ON "content_entry_term" ("entry_id", "term_id") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_content_entry_term_entry_id_unique" ON "content_entry_term" ("entry_id") WHERE term_kind = 'category' AND deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_content_entry_term_term_id" ON "content_entry_term" ("term_id") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `create table if not exists "content_term" ("id" text not null, "kind" text check ("kind" in ('category', 'tag')) not null, "name" text not null, "handle" text not null, "description" text null, "rank" integer not null default 0, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "content_term_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_content_term_deleted_at" ON "content_term" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_content_term_kind_handle_unique" ON "content_term" ("kind", "handle") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_content_term_kind_rank" ON "content_term" ("kind", "rank") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "content_entry_term" cascade;`)

    this.addSql(`drop table if exists "content_term" cascade;`)
  }
}
