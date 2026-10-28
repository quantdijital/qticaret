import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261028020025 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "return_request" drop constraint if exists "return_request_order_id_unique";`
    )
    this.addSql(
      `create table if not exists "return_request" ("id" text not null, "order_id" text not null, "customer_id" text null, "status" text check ("status" in ('requested', 'approved', 'rejected', 'received', 'refunded', 'canceled')) not null default 'requested', "reason" text check ("reason" in ('damaged', 'wrong_item', 'not_as_described', 'changed_mind', 'size_issue', 'other')) not null, "note" text null, "items" jsonb not null, "decision_note" text null, "decided_by" text null, "decided_at" timestamptz null, "return_id" text null, "return_code" text null, "return_shipment_id" text null, "return_label_file_id" text null, "received_items" jsonb null, "received_at" timestamptz null, "refund_amount" integer null, "refund_reference" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "return_request_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_return_request_deleted_at" ON "return_request" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_return_request_order_id" ON "return_request" ("order_id") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_return_request_status_created_at" ON "return_request" ("status", "created_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_return_request_order_id_unique" ON "return_request" ("order_id") WHERE status IN ('requested', 'approved') AND deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "return_request" cascade;`)
  }
}
