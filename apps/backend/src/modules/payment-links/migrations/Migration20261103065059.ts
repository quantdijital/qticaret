import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261103065059 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "payment_link" drop constraint if exists "payment_link_number_unique";`
    )
    this.addSql(
      `alter table if exists "payment_link" drop constraint if exists "payment_link_token_hash_unique";`
    )
    this.addSql(
      `create table if not exists "payment_link" ("id" text not null, "number" serial, "status" text check ("status" in ('draft', 'open', 'paid', 'expired', 'canceled')) not null default 'open', "token_hash" text null, "token_sealed" text null, "token_ends_at" timestamptz not null, "expires_at" timestamptz not null, "created_by" text not null, "customer_id" text null, "sealed" text null, "email_hash" text null, "lines" jsonb not null, "discount" jsonb null, "promotion_id" text null, "promotion_code" text null, "shipping_option_id" text null, "note" text null, "currency_code" text not null default 'try', "items_total" integer not null, "discount_total" integer not null default 0, "cart_id" text null, "order_id" text null, "opened_count" integer not null default 0, "last_opened_at" timestamptz null, "sent_count" integer not null default 0, "last_sent_at" timestamptz null, "paid_at" timestamptz null, "canceled_by" text null, "closed_at" timestamptz null, "purged_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "payment_link_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_payment_link_deleted_at" ON "payment_link" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_payment_link_token_hash_unique" ON "payment_link" ("token_hash") WHERE deleted_at IS NULL AND token_hash IS NOT NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_payment_link_number_unique" ON "payment_link" ("number") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_payment_link_status_expires_at" ON "payment_link" ("status", "expires_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_payment_link_promotion_code" ON "payment_link" ("promotion_code") WHERE deleted_at IS NULL AND promotion_code IS NOT NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_payment_link_customer_id" ON "payment_link" ("customer_id") WHERE deleted_at IS NULL AND customer_id IS NOT NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_payment_link_email_hash" ON "payment_link" ("email_hash") WHERE deleted_at IS NULL AND email_hash IS NOT NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_payment_link_closed_at" ON "payment_link" ("closed_at") WHERE deleted_at IS NULL AND purged_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_payment_link_created_at" ON "payment_link" ("created_at") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "payment_link" cascade;`)
  }
}
