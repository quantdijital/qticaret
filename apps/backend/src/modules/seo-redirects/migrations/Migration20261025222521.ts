import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261025222521 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "seo_redirect" drop constraint if exists "seo_redirect_source_match_unique";`
    )
    this.addSql(
      `alter table if exists "seo_not_found" drop constraint if exists "seo_not_found_path_unique";`
    )
    this.addSql(
      `create table if not exists "seo_not_found" ("id" text not null, "path" text not null, "hits" integer not null default 0, "first_seen_at" timestamptz not null, "last_seen_at" timestamptz not null, "last_referer_host" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "seo_not_found_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_seo_not_found_deleted_at" ON "seo_not_found" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_seo_not_found_path_unique" ON "seo_not_found" ("path") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_seo_not_found_last_seen_at" ON "seo_not_found" ("last_seen_at") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `create table if not exists "seo_redirect" ("id" text not null, "source" text not null, "match" text check ("match" in ('exact', 'prefix', 'pattern')) not null default 'exact', "target" text null, "status" integer not null default 301, "query_policy" text check ("query_policy" in ('keep', 'drop', 'keep_list')) not null default 'keep', "query_keep" text[] null, "origin" text check ("origin" in ('manual', 'import')) not null default 'manual', "hit_count" integer not null default 0, "last_hit_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "seo_redirect_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_seo_redirect_deleted_at" ON "seo_redirect" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_seo_redirect_source_match_unique" ON "seo_redirect" ("source", "match") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_seo_redirect_target" ON "seo_redirect" ("target") WHERE deleted_at IS NULL AND target IS NOT NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "seo_not_found" cascade;`)

    this.addSql(`drop table if exists "seo_redirect" cascade;`)
  }
}
