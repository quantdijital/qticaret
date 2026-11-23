import { Migration } from "@medusajs/framework/mikro-orm/migrations"

// adr/0052 Ek 2026-11-23: add-on templates, and the ones an attribute template carries
export class Migration20261123120000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table if not exists "addon_template" ("id" text not null, "name" text not null, "addons" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "addon_template_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_addon_template_deleted_at" ON "addon_template" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `alter table if exists "attribute_template" add column if not exists "addon_template_ids" jsonb null;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "attribute_template" drop column if exists "addon_template_ids";`
    )
    this.addSql(`drop table if exists "addon_template" cascade;`)
  }
}
