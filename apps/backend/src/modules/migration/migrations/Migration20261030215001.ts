import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261030215001 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "migration_item" add column if not exists "adopted_at" timestamptz null;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "migration_item" drop column if exists "adopted_at";`)
  }
}
