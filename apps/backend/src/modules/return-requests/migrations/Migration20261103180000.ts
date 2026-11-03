import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261103180000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "return_request" add column if not exists "refused_items" jsonb null, add column if not exists "handed_over_at" timestamptz null, add column if not exists "refund_alerted_at" timestamptz null;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "return_request" drop column if exists "refused_items", drop column if exists "handed_over_at", drop column if exists "refund_alerted_at";`
    )
  }
}
