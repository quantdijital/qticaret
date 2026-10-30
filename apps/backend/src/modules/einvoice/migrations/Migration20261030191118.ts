import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261030191118 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "invoice" add column if not exists "cancel_requested_at" timestamptz null;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "invoice" drop column if exists "cancel_requested_at";`)
  }
}
