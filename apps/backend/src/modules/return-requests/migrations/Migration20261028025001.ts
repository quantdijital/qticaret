import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261028025001 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "return_request" add column if not exists "damaged_items" jsonb null, add column if not exists "refund_shipping" boolean not null default false;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "return_request" drop column if exists "damaged_items", drop column if exists "refund_shipping";`
    )
  }
}
