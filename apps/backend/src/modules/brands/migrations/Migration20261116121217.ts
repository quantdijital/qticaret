import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261116121217 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "brand" add column if not exists "logo_width" integer null, add column if not exists "logo_height" integer null;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "brand" drop column if exists "logo_width", drop column if exists "logo_height";`
    )
  }
}
