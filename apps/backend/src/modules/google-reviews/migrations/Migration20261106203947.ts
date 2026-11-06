import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261106203947 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "google_review" add column if not exists "reply_state" text check ("reply_state" in ('pending', 'approved', 'rejected')) null;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "google_review" drop column if exists "reply_state";`)
  }
}
