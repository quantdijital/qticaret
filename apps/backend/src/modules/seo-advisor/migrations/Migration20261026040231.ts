import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261026040231 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "seo_assessment" drop constraint if exists "seo_assessment_entity_type_check";`
    )

    this.addSql(
      `alter table if exists "seo_assessment" add constraint "seo_assessment_entity_type_check" check("entity_type" in ('product', 'category', 'brand', 'collection', 'page', 'post'));`
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "seo_assessment" drop constraint if exists "seo_assessment_entity_type_check";`
    )

    this.addSql(
      `alter table if exists "seo_assessment" add constraint "seo_assessment_entity_type_check" check("entity_type" in ('product', 'category', 'brand', 'collection'));`
    )
  }
}
