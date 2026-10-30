import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261030214202 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table if not exists "migration_cutover" ("id" text not null, "cutover_at" timestamptz not null, "by" text null, "watched_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "migration_cutover_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_migration_cutover_deleted_at" ON "migration_cutover" ("deleted_at") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "migration_cutover" cascade;`)
  }
}
