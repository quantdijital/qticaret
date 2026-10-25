import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261025090154 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "platform_settings_section" drop constraint if exists "platform_settings_section_section_unique";`
    )
    this.addSql(
      `alter table if exists "platform_feature_override" drop constraint if exists "platform_feature_override_key_unique";`
    )
    this.addSql(
      `create table if not exists "platform_feature_override" ("id" text not null, "key" text not null, "enabled" boolean not null, "updated_by" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "platform_feature_override_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_platform_feature_override_key_unique" ON "platform_feature_override" ("key") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_platform_feature_override_deleted_at" ON "platform_feature_override" ("deleted_at") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `create table if not exists "platform_settings_section" ("id" text not null, "section" text not null, "values" jsonb not null, "version" integer not null default 1, "updated_by" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "platform_settings_section_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_platform_settings_section_section_unique" ON "platform_settings_section" ("section") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_platform_settings_section_deleted_at" ON "platform_settings_section" ("deleted_at") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "platform_feature_override" cascade;`)

    this.addSql(`drop table if exists "platform_settings_section" cascade;`)
  }
}
