import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261127143512 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "google_review" add column if not exists "maps_review_id" text null;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "google_review" drop column if exists "maps_review_id";`)
  }
}
