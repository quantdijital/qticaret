import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261027065558 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "integration_credential" drop constraint if exists "integration_credential_provider_unique";`
    )
    this.addSql(
      `create table if not exists "integration_credential" ("id" text not null, "provider" text not null, "settings" jsonb not null, "secret_ciphertext" text not null, "key_id" text not null, "secrets_version" integer not null default 1, "verification" text check ("verification" in ('verified', 'unverified')) not null, "verified_at" timestamptz null, "updated_by" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "integration_credential_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_integration_credential_provider_unique" ON "integration_credential" ("provider") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_integration_credential_deleted_at" ON "integration_credential" ("deleted_at") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "integration_credential" cascade;`)
  }
}
