import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261118093012 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "invoice" drop constraint if exists "invoice_provider_check";`
    )

    this.addSql(
      `alter table if exists "invoice" add column if not exists "reported_at" timestamptz null, add column if not exists "listed_at" timestamptz null;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_invoice_birfatura_due" ON "invoice" ("provider", "kind", "status", "reported_at", "created_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `alter table if exists "invoice" add constraint "invoice_provider_check" check("provider" in ('parasut', 'external', 'fake', 'birfatura'));`
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "invoice" drop constraint if exists "invoice_provider_check";`
    )

    this.addSql(`drop index if exists "IDX_invoice_birfatura_due";`)

    this.addSql(
      `alter table if exists "invoice" drop column if exists "reported_at", drop column if exists "listed_at";`
    )

    this.addSql(
      `alter table if exists "invoice" add constraint "invoice_provider_check" check("provider" in ('parasut', 'external', 'fake'));`
    )
  }
}
