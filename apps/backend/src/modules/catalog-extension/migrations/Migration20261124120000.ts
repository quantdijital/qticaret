import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/**
 * A product's own card badge ("Sınırlı", "Erken rezervasyon"): a short
 * line the shop sets, shown on its card while the shop has manual badges
 * on (`product_badges` settings). Null for every product there is, so
 * nothing changes until a shop writes one.
 */
export class Migration20261124120000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "product_extension" add column if not exists "badge" text null;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "product_extension" drop column if exists "badge";`)
  }
}
