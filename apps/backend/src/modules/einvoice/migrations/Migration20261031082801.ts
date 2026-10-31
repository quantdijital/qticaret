import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261031082801 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table if exists "invoice" drop constraint if exists "invoice_status_check";`)
    this.addSql(
      `alter table if exists "invoice" drop constraint if exists "invoice_document_type_check";`
    )

    this.addSql(
      `alter table if exists "invoice" add column if not exists "waived_reason" text check ("waived_reason" in ('payment_institution', 'signed_return_section')) null;`
    )
    this.addSql(
      `alter table if exists "invoice" add constraint "invoice_status_check" check("status" in ('pending', 'issuing', 'issued', 'failed', 'cancelled', 'waived'));`
    )
    this.addSql(
      `alter table if exists "invoice" add constraint "invoice_document_type_check" check("document_type" in ('e_invoice', 'e_archive', 'expense_voucher', 'return_invoice'));`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "invoice" drop constraint if exists "invoice_status_check";`)
    this.addSql(
      `alter table if exists "invoice" drop constraint if exists "invoice_document_type_check";`
    )

    this.addSql(`alter table if exists "invoice" drop column if exists "waived_reason";`)

    this.addSql(
      `alter table if exists "invoice" add constraint "invoice_status_check" check("status" in ('pending', 'issuing', 'issued', 'failed', 'cancelled'));`
    )
    this.addSql(
      `alter table if exists "invoice" add constraint "invoice_document_type_check" check("document_type" in ('e_invoice', 'e_archive'));`
    )
  }
}
