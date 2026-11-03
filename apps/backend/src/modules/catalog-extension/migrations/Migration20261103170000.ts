import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261103170000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "product_extension" add column if not exists "description_doc" jsonb null;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "product_extension" drop column if exists "description_doc";`
    )
  }
}
