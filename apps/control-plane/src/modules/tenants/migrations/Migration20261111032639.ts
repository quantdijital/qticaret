import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261111032639 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table if exists "tenant" add column if not exists "api_base_url" text null;`)
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "tenant" drop column if exists "api_base_url";`)
  }
}
