import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261030224724 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "product_review" drop constraint if exists "product_review_source_ref_unique";`
    )
    this.addSql(
      `alter table if exists "product_review" add column if not exists "source_ref" text null;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_product_review_source_ref_unique" ON "product_review" ("source_ref") WHERE deleted_at IS NULL AND source_ref IS NOT NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "IDX_product_review_source_ref_unique";`)
    this.addSql(`alter table if exists "product_review" drop column if exists "source_ref";`)
  }
}
