import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261112013758 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "tenant_version" drop constraint if exists "tenant_version_tenant_id_unique";`
    )
    this.addSql(
      `alter table if exists "release" drop constraint if exists "release_version_unique";`
    )
    this.addSql(
      `create table if not exists "release" ("id" text not null, "version" text not null, "commit" text not null, "notes" text null, "created_by" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "release_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_release_deleted_at" ON "release" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_release_version_unique" ON "release" ("version") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_release_created_at" ON "release" ("created_at") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `create table if not exists "tenant_version" ("id" text not null, "tenant_id" text not null, "target_release_id" text null, "set_by" text null, "set_at" timestamptz not null, "reason" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "tenant_version_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_tenant_version_deleted_at" ON "tenant_version" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_tenant_version_tenant_id_unique" ON "tenant_version" ("tenant_id") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_tenant_version_target_release_id" ON "tenant_version" ("target_release_id") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "release" cascade;`)

    this.addSql(`drop table if exists "tenant_version" cascade;`)
  }
}
