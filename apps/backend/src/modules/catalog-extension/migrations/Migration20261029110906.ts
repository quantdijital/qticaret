import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261029110906 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "variant_extension" add column if not exists "cost" integer null;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "variant_extension" drop column if exists "cost";`)
  }
}
