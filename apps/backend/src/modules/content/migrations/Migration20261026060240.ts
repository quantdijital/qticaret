import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261026060240 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "landing_page" add column if not exists "text_live_at" timestamptz null;`
    )
    // A live page's text went live when it last changed, or when it first did
    this.addSql(
      `update "landing_page" set "text_live_at" = coalesce("revised_at", "published_at") where "status" = 'published' and "text_live_at" is null;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "landing_page" drop column if exists "text_live_at";`)
  }
}
