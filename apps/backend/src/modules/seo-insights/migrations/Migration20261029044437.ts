import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261029044437 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "url_inspection" drop constraint if exists "url_inspection_path_unique";`
    )
    this.addSql(
      `alter table if exists "search_page_stat" drop constraint if exists "search_page_stat_path_unique";`
    )
    this.addSql(
      `alter table if exists "insight_run" drop constraint if exists "insight_run_kind_unique";`
    )
    this.addSql(
      `alter table if exists "field_metric" drop constraint if exists "field_metric_form_factor_unique";`
    )
    this.addSql(
      `create table if not exists "field_metric" ("id" text not null, "form_factor" text not null, "has_data" boolean not null, "lcp_ms" integer null, "inp_ms" integer null, "cls_x1000" integer null, "collected_at" timestamptz not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "field_metric_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_field_metric_deleted_at" ON "field_metric" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_field_metric_form_factor_unique" ON "field_metric" ("form_factor") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `create table if not exists "insight_run" ("id" text not null, "kind" text not null, "ran_at" timestamptz not null, "error" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "insight_run_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_insight_run_deleted_at" ON "insight_run" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_insight_run_kind_unique" ON "insight_run" ("kind") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `create table if not exists "search_page_stat" ("id" text not null, "path" text not null, "clicks" integer not null, "impressions" integer not null, "ctr_bp" integer not null, "position_x100" integer not null, "prev_clicks" integer not null, "prev_impressions" integer not null, "period_end" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "search_page_stat_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_search_page_stat_deleted_at" ON "search_page_stat" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_search_page_stat_path_unique" ON "search_page_stat" ("path") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `create table if not exists "url_inspection" ("id" text not null, "path" text not null, "verdict" text not null, "coverage_state" text null, "last_crawl_at" timestamptz null, "inspected_at" timestamptz not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "url_inspection_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_url_inspection_deleted_at" ON "url_inspection" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_url_inspection_path_unique" ON "url_inspection" ("path") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_url_inspection_inspected_at" ON "url_inspection" ("inspected_at") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "field_metric" cascade;`)

    this.addSql(`drop table if exists "insight_run" cascade;`)

    this.addSql(`drop table if exists "search_page_stat" cascade;`)

    this.addSql(`drop table if exists "url_inspection" cascade;`)
  }
}
