import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261026130541 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table if not exists "price_record" ("id" text not null, "seq" serial, "variant_id" text not null, "currency_code" text not null, "amount" numeric not null, "original_amount" numeric not null, "price_list_id" text null, "reason" text check ("reason" in ('price_change', 'reconcile', 'opening', 'import')) not null, "recorded_at" timestamptz not null, "raw_amount" jsonb not null, "raw_original_amount" jsonb not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "price_record_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_price_record_deleted_at" ON "price_record" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_price_record_variant_id_currency_code_recorded_at" ON "price_record" ("variant_id", "currency_code", "recorded_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_price_record_variant_id_currency_code_seq" ON "price_record" ("variant_id", "currency_code", "seq") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "price_record" cascade;`)
  }
}
