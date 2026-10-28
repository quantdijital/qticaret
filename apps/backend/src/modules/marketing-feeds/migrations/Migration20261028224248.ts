import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261028224248 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "feed_file" drop constraint if exists "feed_file_target_unique";`
    )
    this.addSql(
      `create table if not exists "feed_access" ("id" text not null, "token_hash" text not null, "token_encrypted" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "feed_access_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_feed_access_deleted_at" ON "feed_access" ("deleted_at") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `create table if not exists "feed_file" ("id" text not null, "target" text not null, "file_key" text not null, "item_count" integer not null, "generated_at" timestamptz not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "feed_file_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_feed_file_deleted_at" ON "feed_file" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_feed_file_target_unique" ON "feed_file" ("target") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "feed_access" cascade;`)

    this.addSql(`drop table if exists "feed_file" cascade;`)
  }
}
