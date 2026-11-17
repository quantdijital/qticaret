import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261117101746 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "media_video" add column if not exists "retry_from" integer not null default 0;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "media_video" drop column if exists "retry_from";`)
  }
}
