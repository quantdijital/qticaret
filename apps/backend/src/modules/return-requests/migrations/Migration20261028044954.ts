import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261028044954 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "return_request" add column if not exists "kind" text check ("kind" in ('return', 'exchange')) not null default 'return', add column if not exists "exchange_items" jsonb null, add column if not exists "difference" integer null, add column if not exists "exchange_id" text null;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "return_request" drop column if exists "kind", drop column if exists "exchange_items", drop column if exists "difference", drop column if exists "exchange_id";`
    )
  }
}
