import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261111015439 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "secret_record" drop constraint if exists "secret_record_owner_name_version_unique";`
    )
    this.addSql(
      `alter table if exists "secret_escrow" drop constraint if exists "secret_escrow_tenant_id_version_unique";`
    )
    this.addSql(
      `alter table if exists "cp_signing_key" drop constraint if exists "cp_signing_key_kid_unique";`
    )
    this.addSql(
      `create table if not exists "cp_signing_key" ("id" text not null, "kid" text not null, "public_key" text not null, "status" text check ("status" in ('next', 'active', 'previous', 'retired')) not null, "secret_name" text not null, "activated_at" timestamptz null, "retired_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "cp_signing_key_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_cp_signing_key_deleted_at" ON "cp_signing_key" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_cp_signing_key_kid_unique" ON "cp_signing_key" ("kid") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_cp_signing_key_one_next" ON "cp_signing_key" ("status") WHERE status = 'next' AND deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_cp_signing_key_one_active" ON "cp_signing_key" ("status") WHERE status = 'active' AND deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_cp_signing_key_one_previous" ON "cp_signing_key" ("status") WHERE status = 'previous' AND deleted_at IS NULL;`
    )

    this.addSql(
      `create table if not exists "secret_escrow" ("id" text not null, "tenant_id" text not null, "version" integer not null, "sealed" text not null, "recipients" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "secret_escrow_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_secret_escrow_deleted_at" ON "secret_escrow" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_secret_escrow_tenant_id_version_unique" ON "secret_escrow" ("tenant_id", "version") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `create table if not exists "secret_record" ("id" text not null, "owner" text not null, "name" text not null, "version" integer not null, "kek_id" text not null, "sealed" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "secret_record_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_secret_record_deleted_at" ON "secret_record" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_secret_record_owner_name_version_unique" ON "secret_record" ("owner", "name", "version") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_secret_record_kek_id" ON "secret_record" ("kek_id") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "cp_signing_key" cascade;`)

    this.addSql(`drop table if exists "secret_escrow" cascade;`)

    this.addSql(`drop table if exists "secret_record" cascade;`)
  }
}
