import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261030123155 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table if not exists "legal_consent" ("id" text not null, "cart_id" text not null, "order_id" text null, "documents" jsonb not null, "ip_encrypted" text null, "given_at" timestamptz not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "legal_consent_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_legal_consent_deleted_at" ON "legal_consent" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_legal_consent_cart" ON "legal_consent" ("cart_id") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_legal_consent_order" ON "legal_consent" ("order_id") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `create table if not exists "legal_order_copy" ("id" text not null, "order_id" text not null, "kind" text check ("kind" in ('distance_sales', 'pre_information', 'privacy_notice', 'cookie_policy', 'return_policy', 'shipping_policy', 'membership')) not null, "version" integer not null, "document_id" text not null, "title" text not null, "html_encrypted" text not null, "html_hash" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "legal_order_copy_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_legal_order_copy_deleted_at" ON "legal_order_copy" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_legal_order_copy_order_kind" ON "legal_order_copy" ("order_id", "kind") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "legal_consent" cascade;`)

    this.addSql(`drop table if exists "legal_order_copy" cascade;`)
  }
}
