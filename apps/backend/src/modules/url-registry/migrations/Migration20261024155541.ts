import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261024155541 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "url_entry" drop constraint if exists "url_entry_locale_path_unique";`
    )
    this.addSql(
      `create table if not exists "url_entry" ("id" text not null, "locale" text not null, "path" text not null, "status" text check ("status" in ('active', 'reserved')) not null default 'active', "entity_type" text not null, "entity_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "url_entry_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_url_entry_deleted_at" ON "url_entry" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_url_entry_locale_path_unique" ON "url_entry" ("locale", "path") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_url_entry_entity_type_entity_id" ON "url_entry" ("entity_type", "entity_id") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "url_entry" cascade;`)
  }
}
