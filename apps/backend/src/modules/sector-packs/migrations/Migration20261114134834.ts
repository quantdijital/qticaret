import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261114134834 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "sector_pack_item" drop constraint if exists "sector_pack_item_kind_check";`
    )

    this.addSql(
      `alter table if exists "sector_pack_item" add constraint "sector_pack_item_kind_check" check("kind" in ('attribute_template', 'attribute', 'category', 'flag', 'seo_template', 'preset_image', 'demo_record'));`
    )
  }

  /**
   * Back to the kinds before adr/0063: the rows of the two kinds this
   * migration allowed (a preset's images, its demo records) would fail the
   * narrower check, so they go first. Only the ledger's rows: the media and
   * the records they name stay in the shop, no longer offered as the preset's.
   */
  override async down(): Promise<void> {
    this.addSql(`delete from "sector_pack_item" where "kind" in ('preset_image', 'demo_record');`)

    this.addSql(
      `alter table if exists "sector_pack_item" drop constraint if exists "sector_pack_item_kind_check";`
    )

    this.addSql(
      `alter table if exists "sector_pack_item" add constraint "sector_pack_item_kind_check" check("kind" in ('attribute_template', 'attribute', 'category', 'flag', 'seo_template'));`
    )
  }
}
