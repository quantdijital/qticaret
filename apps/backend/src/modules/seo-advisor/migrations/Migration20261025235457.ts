import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261025235457 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "seo_assessment" drop constraint if exists "seo_assessment_entity_type_entity_id_unique";`
    )
    this.addSql(
      `create table if not exists "seo_assessment" ("id" text not null, "entity_type" text check ("entity_type" in ('product', 'category', 'brand', 'collection')) not null, "entity_id" text not null, "score" integer not null, "grade" text check ("grade" in ('excellent', 'good', 'needs_work', 'poor')) not null, "issues" jsonb not null, "critical" integer not null default 0, "rules_version" integer not null, "computed_at" timestamptz not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "seo_assessment_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_seo_assessment_deleted_at" ON "seo_assessment" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_seo_assessment_entity_type_entity_id_unique" ON "seo_assessment" ("entity_type", "entity_id") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_seo_assessment_entity_type_score" ON "seo_assessment" ("entity_type", "score") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "seo_assessment" cascade;`)
  }
}
