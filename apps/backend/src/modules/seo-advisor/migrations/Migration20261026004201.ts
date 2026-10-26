import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261026004201 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "seo_assessment" add column if not exists "title_hash" text null, add column if not exists "description_hash" text null, add column if not exists "is_listed" boolean not null default false;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_seo_assessment_entity_type_title_hash" ON "seo_assessment" ("entity_type", "title_hash") WHERE deleted_at IS NULL AND is_listed IS TRUE AND title_hash IS NOT NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_seo_assessment_entity_type_description_hash" ON "seo_assessment" ("entity_type", "description_hash") WHERE deleted_at IS NULL AND is_listed IS TRUE AND description_hash IS NOT NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "IDX_seo_assessment_entity_type_title_hash";`)
    this.addSql(`drop index if exists "IDX_seo_assessment_entity_type_description_hash";`)
    this.addSql(
      `alter table if exists "seo_assessment" drop column if exists "title_hash", drop column if exists "description_hash", drop column if exists "is_listed";`
    )
  }
}
