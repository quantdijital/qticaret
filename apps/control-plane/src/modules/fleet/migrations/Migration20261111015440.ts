import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261111015440 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "tenant_key" drop constraint if exists "tenant_key_kid_unique";`
    )
    this.addSql(
      `create table if not exists "tenant_key" ("id" text not null, "tenant_id" text not null, "kid" text not null, "public_key" text not null, "status" text check ("status" in ('active', 'next', 'retired')) not null, "retired_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "tenant_key_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_tenant_key_deleted_at" ON "tenant_key" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_tenant_key_kid_unique" ON "tenant_key" ("kid") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_tenant_key_tenant_id" ON "tenant_key" ("tenant_id") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_tenant_key_one_active" ON "tenant_key" ("tenant_id") WHERE status = 'active' AND deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_tenant_key_one_next" ON "tenant_key" ("tenant_id") WHERE status = 'next' AND deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "tenant_key" cascade;`)
  }
}
