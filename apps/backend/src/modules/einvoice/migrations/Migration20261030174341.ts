import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261030174341 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "invoice" drop constraint if exists "invoice_number_unique";`
    )
    this.addSql(
      `alter table if exists "invoice" drop constraint if exists "invoice_order_id_kind_source_id_unique";`
    )
    this.addSql(
      `create table if not exists "invoice" ("id" text not null, "order_id" text not null, "kind" text check ("kind" in ('sale', 'return')) not null, "source_id" text not null, "provider" text check ("provider" in ('parasut', 'external', 'fake')) not null, "status" text check ("status" in ('pending', 'issuing', 'issued', 'failed', 'cancelled')) not null default 'pending', "document_type" text check ("document_type" in ('e_invoice', 'e_archive')) null, "attempts" integer not null default 0, "next_attempt_at" timestamptz not null, "last_error" text null, "external_id" text null, "document_id" text null, "job_id" text null, "job_started_at" timestamptz null, "number" text null, "uuid" text null, "issued_at" timestamptz null, "cancellable_until" timestamptz null, "pdf_file_id" text null, "net_total" numeric not null, "vat_total" numeric not null, "gross_total" numeric not null, "program_difference" integer null, "original_invoice_id" text null, "raw_net_total" jsonb not null, "raw_vat_total" jsonb not null, "raw_gross_total" jsonb not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "invoice_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_invoice_deleted_at" ON "invoice" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_invoice_order_id_kind_source_id_unique" ON "invoice" ("order_id", "kind", "source_id") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_invoice_status_next_attempt_at" ON "invoice" ("status", "next_attempt_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_invoice_order_id" ON "invoice" ("order_id") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_invoice_number_unique" ON "invoice" ("number") WHERE number IS NOT NULL AND deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "invoice" cascade;`)
  }
}
