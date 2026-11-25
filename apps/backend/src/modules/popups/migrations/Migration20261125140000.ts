import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/** adr/0080 §6a: a pop-up's design, `classic` for every pop-up made before. */
export class Migration20261125140000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "popup" add column if not exists "design" text check ("design" in ('classic', 'split', 'hero', 'minimal', 'coupon')) not null default 'classic';`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "popup" drop column if exists "design";`)
  }
}
