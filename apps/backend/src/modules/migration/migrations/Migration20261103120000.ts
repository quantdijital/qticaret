import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261103120000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "migration_run" add column if not exists "error_code" text null;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "migration_run" drop column if exists "error_code";`)
  }
}
