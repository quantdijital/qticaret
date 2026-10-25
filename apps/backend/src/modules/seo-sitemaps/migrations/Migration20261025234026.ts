import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261025234026 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "sitemap_state" drop constraint if exists "sitemap_state_key_unique";`
    )
    this.addSql(
      `alter table if exists "sitemap_file" drop constraint if exists "sitemap_file_name_unique";`
    )
    this.addSql(
      `create table if not exists "sitemap_file" ("id" text not null, "name" text not null, "content" text not null, "url_count" integer not null default 0, "generated_at" timestamptz not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "sitemap_file_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_sitemap_file_deleted_at" ON "sitemap_file" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_sitemap_file_name_unique" ON "sitemap_file" ("name") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `create table if not exists "sitemap_state" ("id" text not null, "key" text not null, "dirty_since" timestamptz null, "generated_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "sitemap_state_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_sitemap_state_key_unique" ON "sitemap_state" ("key") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_sitemap_state_deleted_at" ON "sitemap_state" ("deleted_at") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "sitemap_file" cascade;`)

    this.addSql(`drop table if exists "sitemap_state" cascade;`)
  }
}
