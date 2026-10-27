import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261027212945 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table if not exists "chargeback" ("id" text not null, "order_id" text not null, "payment_id" text not null, "provider" text not null, "provider_reference" text null, "amount" integer not null, "currency_code" text not null, "reason" text check ("reason" in ('not_received', 'unauthorized', 'not_as_described', 'duplicate', 'other')) not null, "status" text check ("status" in ('open', 'evidence_submitted', 'won', 'lost')) not null default 'open', "due_at" timestamptz null, "note" text null, "created_by" text null, "closed_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "chargeback_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_chargeback_deleted_at" ON "chargeback" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_chargeback_order_id" ON "chargeback" ("order_id") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_chargeback_payment_id_status" ON "chargeback" ("payment_id", "status") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_chargeback_status_due_at" ON "chargeback" ("status", "due_at") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "chargeback" cascade;`)
  }
}
