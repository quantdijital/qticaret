import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261111175512 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "tenant_status_change" add column if not exists "note" text null;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "tenant_status_change" drop column if exists "note";`)
  }
}
