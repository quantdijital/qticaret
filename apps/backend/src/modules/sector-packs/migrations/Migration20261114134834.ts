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

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "sector_pack_item" drop constraint if exists "sector_pack_item_kind_check";`
    )

    this.addSql(
      `alter table if exists "sector_pack_item" add constraint "sector_pack_item_kind_check" check("kind" in ('attribute_template', 'attribute', 'category', 'flag', 'seo_template'));`
    )
  }
}
