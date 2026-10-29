import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261028232554 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "merchant_offer" drop constraint if exists "merchant_offer_offer_id_unique";`
    )
    this.addSql(
      `alter table if exists "google_oauth_state" drop constraint if exists "google_oauth_state_state_hash_unique";`
    )
    this.addSql(
      `create table if not exists "google_oauth_state" ("id" text not null, "state_hash" text not null, "verifier_encrypted" text not null, "user_id" text not null, "expires_at" timestamptz not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "google_oauth_state_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_google_oauth_state_deleted_at" ON "google_oauth_state" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_google_oauth_state_state_hash_unique" ON "google_oauth_state" ("state_hash") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `create table if not exists "merchant_offer" ("id" text not null, "offer_id" text not null, "input_hash" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "merchant_offer_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_merchant_offer_deleted_at" ON "merchant_offer" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_merchant_offer_offer_id_unique" ON "merchant_offer" ("offer_id") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `create table if not exists "merchant_sync" ("id" text not null, "sent" integer not null, "removed" integer not null, "failed" integer not null, "error" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "merchant_sync_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_merchant_sync_deleted_at" ON "merchant_sync" ("deleted_at") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "google_oauth_state" cascade;`)

    this.addSql(`drop table if exists "merchant_offer" cascade;`)

    this.addSql(`drop table if exists "merchant_sync" cascade;`)
  }
}
