import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261104210344 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "attribute_template" add column if not exists "groups" jsonb null;`
    )

    this.addSql(
      `alter table if exists "attribute_definition" add column if not exists "group" text null;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "attribute_template" drop column if exists "groups";`)

    this.addSql(`alter table if exists "attribute_definition" drop column if exists "group";`)
  }
}
