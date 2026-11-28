import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261128143512 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "tenant" add column if not exists "preset" text null, add column if not exists "preset_version" integer null, add column if not exists "preset_applied_at" timestamptz null;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "tenant" drop column if exists "preset", drop column if exists "preset_version", drop column if exists "preset_applied_at";`
    )
  }
}
