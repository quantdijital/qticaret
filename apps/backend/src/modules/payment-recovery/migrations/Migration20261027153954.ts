import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261027153954 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "payment_recovery" drop constraint if exists "payment_recovery_provider_reference_unique";`
    )
    this.addSql(
      `create table if not exists "payment_recovery" ("id" text not null, "provider" text not null, "reference" text not null, "amount" integer not null, "currency_code" text not null, "test_mode" boolean not null, "reason" text check ("reason" in ('session_gone', 'amount_mismatch', 'completion_failed')) not null, "status" text check ("status" in ('pending', 'refunded', 'failed')) not null default 'pending', "attempts" integer not null default 0, "refund_reference" text not null, "error_code" text null, "cart_id" text null, "refunded_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "payment_recovery_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_payment_recovery_deleted_at" ON "payment_recovery" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_payment_recovery_provider_reference_unique" ON "payment_recovery" ("provider", "reference") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_payment_recovery_status_updated_at" ON "payment_recovery" ("status", "updated_at") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "payment_recovery" cascade;`)
  }
}
