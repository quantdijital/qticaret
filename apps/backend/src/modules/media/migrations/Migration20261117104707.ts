import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261117104707 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "media_video" add column if not exists "retry_from" integer not null default 0, add column if not exists "failed_at" timestamptz null;`
    )
    // adr/0069 slice 3: a clip failed before this column was kept failed when it last changed
    this.addSql(
      `update "media_video" set "failed_at" = "updated_at" where "status" = 'failed' and "failed_at" is null;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "media_video" drop column if exists "retry_from", drop column if exists "failed_at";`
    )
  }
}
