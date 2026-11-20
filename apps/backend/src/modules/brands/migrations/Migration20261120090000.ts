import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/** A brand's description as a content document (adr/0075); `description` keeps its plain text. */
export class Migration20261120090000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "brand" add column if not exists "description_doc" jsonb null;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "brand" drop column if exists "description_doc";`)
  }
}
