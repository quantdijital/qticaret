import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261029121235 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "api_key_scope" drop constraint if exists "api_key_scope_api_key_id_unique";`
    )
    this.addSql(
      `create table if not exists "api_key_scope" ("id" text not null, "api_key_id" text not null, "scopes" text[] not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "api_key_scope_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_api_key_scope_deleted_at" ON "api_key_scope" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_api_key_scope_api_key_id_unique" ON "api_key_scope" ("api_key_id") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "api_key_scope" cascade;`)
  }
}
