import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/** Who last changed a question's words from the panel, and when (owner 2026-11-27). */
export class Migration20261127183000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "product_question" add column if not exists "edited_by" text null, add column if not exists "edited_at" timestamptz null;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "product_question" drop column if exists "edited_by", drop column if exists "edited_at";`
    )
  }
}
