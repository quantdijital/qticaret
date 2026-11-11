import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261111033458 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "platform_flag" drop constraint if exists "platform_flag_key_unique";`
    )
    this.addSql(
      `create table if not exists "platform_flag" ("id" text not null, "key" text not null, "enabled" boolean not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "platform_flag_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_platform_flag_key_unique" ON "platform_flag" ("key") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_platform_flag_deleted_at" ON "platform_flag" ("deleted_at") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "platform_flag" cascade;`)
  }
}
