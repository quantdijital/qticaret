import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261025215748 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table if not exists "seo_meta" ("id" text not null, "entity_type" text check ("entity_type" in ('product', 'category', 'collection', 'brand', 'page', 'post', 'landing')) not null, "seo_title" text null, "seo_description" text null, "focus_keyword" text null, "canonical_override" text null, "robots_override" text check ("robots_override" in ('index_follow', 'noindex_follow', 'noindex_nofollow')) null, "og_image_override" text null, "og_image_alt" text null, "title_hash" text null, "description_hash" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "seo_meta_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_seo_meta_deleted_at" ON "seo_meta" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_seo_meta_entity_type_title_hash" ON "seo_meta" ("entity_type", "title_hash") WHERE title_hash IS NOT NULL AND deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_seo_meta_entity_type_description_hash" ON "seo_meta" ("entity_type", "description_hash") WHERE description_hash IS NOT NULL AND deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "seo_meta" cascade;`)
  }
}
