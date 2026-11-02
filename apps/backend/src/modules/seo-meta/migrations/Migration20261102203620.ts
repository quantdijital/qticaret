import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261102203620 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "seo_meta" drop constraint if exists "seo_meta_entity_type_check";`
    )

    this.addSql(
      `alter table if exists "seo_meta" add constraint "seo_meta_entity_type_check" check("entity_type" in ('product', 'category', 'collection', 'brand', 'page', 'post', 'landing', 'post_category', 'post_tag'));`
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "seo_meta" drop constraint if exists "seo_meta_entity_type_check";`
    )

    this.addSql(
      `alter table if exists "seo_meta" add constraint "seo_meta_entity_type_check" check("entity_type" in ('product', 'category', 'collection', 'brand', 'page', 'post', 'landing'));`
    )
  }
}
