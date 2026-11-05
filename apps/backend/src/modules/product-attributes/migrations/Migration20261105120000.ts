import { Migration } from "@medusajs/framework/mikro-orm/migrations"

// adr/0013 Ek 2026-11-05: a field's other names, for the facts in product descriptions
export class Migration20261105120000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "attribute_definition" add column if not exists "aliases" jsonb null;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "attribute_definition" drop column if exists "aliases";`)
  }
}
