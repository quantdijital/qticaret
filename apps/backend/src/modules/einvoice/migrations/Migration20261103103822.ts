import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261103103822 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "invoice" drop constraint if exists "invoice_waived_reason_check";`
    )

    this.addSql(
      `alter table if exists "invoice" add column if not exists "advance_total" numeric null, add column if not exists "raw_advance_total" jsonb null;`
    )
    this.addSql(
      `alter table if exists "invoice" add constraint "invoice_waived_reason_check" check("waived_reason" in ('payment_institution', 'signed_return_section', 'advance_only'));`
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "invoice" drop constraint if exists "invoice_waived_reason_check";`
    )

    this.addSql(
      `alter table if exists "invoice" drop column if exists "advance_total", drop column if exists "raw_advance_total";`
    )

    this.addSql(
      `alter table if exists "invoice" add constraint "invoice_waived_reason_check" check("waived_reason" in ('payment_institution', 'signed_return_section'));`
    )
  }
}
