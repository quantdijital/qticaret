import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261030193313 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table if exists "invoice" add column if not exists "company_id" text null;`)
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "invoice" drop column if exists "company_id";`)
  }
}
