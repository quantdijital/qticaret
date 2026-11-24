import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/**
 * A dated product's program (adr/0078): `bookable.program`, the ordered
 * steps (a day, a lesson, a session) the page shows, as one JSON value
 * the server checks on every save. Existing products have none (null);
 * down drops the column and every program with it.
 */
export class Migration20261124090000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table if exists "bookable" add column if not exists "program" jsonb null;`)
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "bookable" drop column if exists "program";`)
  }
}
