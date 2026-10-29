import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261029123655 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "search_term_day" drop constraint if exists "search_term_day_day_term_unique";`
    )
    this.addSql(
      `create table if not exists "search_term_day" ("id" text not null, "day" text not null, "term" text not null, "searches" integer not null default 0, "zero_results" integer not null default 0, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "search_term_day_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_search_term_day_deleted_at" ON "search_term_day" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_search_term_day_day_term_unique" ON "search_term_day" ("day", "term") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_search_term_day_term" ON "search_term_day" ("term") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "search_term_day" cascade;`)
  }
}
