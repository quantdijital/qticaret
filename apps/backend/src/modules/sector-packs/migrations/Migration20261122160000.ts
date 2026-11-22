import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261122160000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "sector_pack_item" drop constraint if exists "sector_pack_item_kind_check";`
    )

    this.addSql(
      `alter table if exists "sector_pack_item" add constraint "sector_pack_item_kind_check" check("kind" in ('attribute_template', 'attribute', 'category', 'flag', 'seo_template', 'preset_image', 'demo_record', 'page', 'setting'));`
    )
  }

  /**
   * Back to the kinds before adr/0076 §12: the ledger's rows of the two
   * kinds this migration allowed (a pack's draft pages, its catalog
   * defaults) would fail the narrower check, so they go first. The pages
   * and settings they name stay in the shop.
   */
  override async down(): Promise<void> {
    this.addSql(`delete from "sector_pack_item" where "kind" in ('page', 'setting');`)

    this.addSql(
      `alter table if exists "sector_pack_item" drop constraint if exists "sector_pack_item_kind_check";`
    )

    this.addSql(
      `alter table if exists "sector_pack_item" add constraint "sector_pack_item_kind_check" check("kind" in ('attribute_template', 'attribute', 'category', 'flag', 'seo_template', 'preset_image', 'demo_record'));`
    )
  }
}
