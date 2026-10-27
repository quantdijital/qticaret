import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261027191205 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "order_refund" add column if not exists "provider_parts" jsonb null;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "order_refund" drop column if exists "provider_parts";`)
  }
}
