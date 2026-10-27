import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261027160913 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "order_refund" drop constraint if exists "order_refund_reference_unique";`
    )
    this.addSql(
      `create table if not exists "order_refund" ("id" text not null, "order_id" text not null, "reference" text not null, "payment_id" text not null, "amount" integer not null, "status" text check ("status" in ('pending', 'done', 'failed')) not null default 'pending', "lines" jsonb not null, "note" text null, "created_by" text null, "error_code" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "order_refund_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_order_refund_reference_unique" ON "order_refund" ("reference") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_order_refund_deleted_at" ON "order_refund" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_order_refund_order_id_status" ON "order_refund" ("order_id", "status") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "order_refund" cascade;`)
  }
}
