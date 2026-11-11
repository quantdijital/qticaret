import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261111041955 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "platform_flag" add column if not exists "serial" integer not null default 0;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "platform_flag" drop column if exists "serial";`)
  }
}
