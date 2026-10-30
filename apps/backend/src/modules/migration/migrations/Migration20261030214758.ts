import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261030214758 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "migration_item" add column if not exists "invite_queued_at" timestamptz null, add column if not exists "invited_at" timestamptz null;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "migration_item" drop column if exists "invite_queued_at", drop column if exists "invited_at";`
    )
  }
}
