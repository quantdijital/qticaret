import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/**
 * A blog category's or tag's description as a content document (adr/0075
 * Ek 2026-11-24); `description` keeps its plain text. Existing rows keep
 * theirs and open in the panel as its paragraphs (no data moved).
 */
export class Migration20261124160000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "content_term" add column if not exists "description_doc" jsonb null;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "content_term" drop column if exists "description_doc";`)
  }
}
