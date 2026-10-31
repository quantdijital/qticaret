import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261031090245 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "invoice" drop constraint if exists "invoice_voucher_number_unique";`
    )
    this.addSql(
      `alter table if exists "invoice" drop constraint if exists "invoice_sale_number_unique";`
    )
    this.addSql(`drop index if exists "IDX_invoice_number_unique";`)

    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_invoice_sale_number_unique" ON "invoice" ("number") WHERE kind = 'sale' AND number IS NOT NULL AND deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_invoice_voucher_number_unique" ON "invoice" ("number") WHERE kind = 'return' AND document_type = 'expense_voucher' AND number IS NOT NULL AND deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "IDX_invoice_sale_number_unique";`)
    this.addSql(`drop index if exists "IDX_invoice_voucher_number_unique";`)

    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_invoice_number_unique" ON "invoice" ("number") WHERE number IS NOT NULL AND deleted_at IS NULL;`
    )
  }
}
