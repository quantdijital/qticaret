import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261031111411 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "attribute_definition" add column if not exists "is_public" boolean not null default true;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "attribute_definition" drop column if exists "is_public";`)
  }
}
