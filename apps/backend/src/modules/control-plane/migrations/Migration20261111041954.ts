import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261111041954 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "control_plane_plan" alter column "confirmed_at" type timestamptz using ("confirmed_at"::timestamptz);`
    )
    this.addSql(
      `alter table if exists "control_plane_plan" alter column "confirmed_at" drop not null;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "control_plane_plan" alter column "confirmed_at" type timestamptz using ("confirmed_at"::timestamptz);`
    )
    this.addSql(
      `alter table if exists "control_plane_plan" alter column "confirmed_at" set not null;`
    )
  }
}
