import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/** The shop's reply to a review: its text, who wrote it and when. */
export class Migration20261110183000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "product_review" add column if not exists "reply" text null, add column if not exists "replied_by" text null, add column if not exists "replied_at" timestamptz null;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "product_review" drop column if exists "reply", drop column if exists "replied_by", drop column if exists "replied_at";`
    )
  }
}
