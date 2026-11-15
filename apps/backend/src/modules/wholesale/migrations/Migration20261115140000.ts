import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/**
 * ADR-0068: wholesale levels, accounts and hand-entered prices. Written by
 * hand (no env in the agent's worktree); `medusa db:generate wholesale`
 * against it should report no changes.
 */
export class Migration20261115140000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table if not exists "wholesale_account" ("id" text not null, "customer_id" text null, "email" text null, "company_name" text null, "contact_name" text null, "tier_id" text null, "private_group_id" text null, "private_price_list_id" text null, "rate_bps" integer null, "min_quantity" integer null, "status" text check ("status" in ('pending', 'active', 'inactive')) not null default 'pending', "invited_at" timestamptz null, "activated_at" timestamptz null, "deactivated_at" timestamptz null, "sync_requested_at" timestamptz null, "synced_at" timestamptz null, "created_by" text null, "updated_by" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "wholesale_account_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_wholesale_account_deleted_at" ON "wholesale_account" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_wholesale_account_customer_id_unique" ON "wholesale_account" ("customer_id") WHERE deleted_at IS NULL AND customer_id IS NOT NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_wholesale_account_email_unique" ON "wholesale_account" ("email") WHERE deleted_at IS NULL AND email IS NOT NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_wholesale_account_tier_id" ON "wholesale_account" ("tier_id") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_wholesale_account_private_group_id_unique" ON "wholesale_account" ("private_group_id") WHERE deleted_at IS NULL AND private_group_id IS NOT NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_wholesale_account_private_price_list_id_unique" ON "wholesale_account" ("private_price_list_id") WHERE deleted_at IS NULL AND private_price_list_id IS NOT NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_wholesale_account_status" ON "wholesale_account" ("status") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `create table if not exists "wholesale_manual_price" ("id" text not null, "price_list_id" text not null, "variant_id" text not null, "net_amount" integer not null, "created_by" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "wholesale_manual_price_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_wholesale_manual_price_deleted_at" ON "wholesale_manual_price" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_wholesale_manual_price_price_list_id_variant_id_unique" ON "wholesale_manual_price" ("price_list_id", "variant_id") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_wholesale_manual_price_variant_id" ON "wholesale_manual_price" ("variant_id") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `create table if not exists "wholesale_tier" ("id" text not null, "name" text not null, "customer_group_id" text not null, "price_list_id" text not null, "rate_bps" integer null, "min_quantity" integer null, "sync_requested_at" timestamptz null, "synced_at" timestamptz null, "created_by" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "wholesale_tier_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_wholesale_tier_deleted_at" ON "wholesale_tier" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_wholesale_tier_name_unique" ON "wholesale_tier" ("name") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_wholesale_tier_customer_group_id_unique" ON "wholesale_tier" ("customer_group_id") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_wholesale_tier_price_list_id_unique" ON "wholesale_tier" ("price_list_id") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "wholesale_account" cascade;`)
    this.addSql(`drop table if exists "wholesale_manual_price" cascade;`)
    this.addSql(`drop table if exists "wholesale_tier" cascade;`)
  }
}
