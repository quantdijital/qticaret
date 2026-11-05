import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261106171523 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table if not exists "migration_file" ("id" text not null, "source" text not null, "path" text not null, "stem" text not null, "media_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "migration_file_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_migration_file_deleted_at" ON "migration_file" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_migration_file_path_unique" ON "migration_file" ("path") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_migration_file_stem" ON "migration_file" ("stem") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "migration_file" cascade;`)
  }
}
