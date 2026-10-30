import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261030212334 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "seo_redirect" drop constraint if exists "seo_redirect_origin_check";`
    )

    this.addSql(
      `alter table if exists "seo_redirect" add constraint "seo_redirect_origin_check" check("origin" in ('manual', 'import', 'migration'));`
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "seo_redirect" drop constraint if exists "seo_redirect_origin_check";`
    )

    this.addSql(
      `alter table if exists "seo_redirect" add constraint "seo_redirect_origin_check" check("origin" in ('manual', 'import'));`
    )
  }
}
