import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261118093012 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "invoice" drop constraint if exists "invoice_provider_check";`
    )

    this.addSql(
      `alter table if exists "invoice" add column if not exists "reported_at" timestamptz null;`
    )
    this.addSql(
      `alter table if exists "invoice" add constraint "invoice_provider_check" check("provider" in ('parasut', 'external', 'fake', 'birfatura'));`
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "invoice" drop constraint if exists "invoice_provider_check";`
    )

    this.addSql(`alter table if exists "invoice" drop column if exists "reported_at";`)

    this.addSql(
      `alter table if exists "invoice" add constraint "invoice_provider_check" check("provider" in ('parasut', 'external', 'fake'));`
    )
  }
}
