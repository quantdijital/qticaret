import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/** adr/0080: storefront pop-ups and their daily counters. */
export class Migration20261124080000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "popup_metric" drop constraint if exists "popup_metric_popup_id_day_unique";`
    )
    this.addSql(
      `create table if not exists "popup" ("id" text not null, "name" text not null, "type" text check ("type" in ('info', 'campaign', 'newsletter')) not null, "is_active" boolean not null default false, "starts_at" timestamptz null, "ends_at" timestamptz null, "priority" integer not null default 0, "title" text not null, "body" text null, "image_url" text null, "image_alt" text null, "button_label" text null, "button_href" text null, "promotion_id" text null, "page_scope" text check ("page_scope" in ('all', 'selected')) not null default 'all', "pages" jsonb not null, "device" text check ("device" in ('all', 'desktop', 'mobile')) not null default 'all', "visitor" text check ("visitor" in ('any', 'new', 'returning')) not null default 'any', "membership" text check ("membership" in ('any', 'member', 'guest')) not null default 'any', "trigger" text check ("trigger" in ('delay', 'scroll')) not null default 'delay', "trigger_value" integer not null default 5, "frequency" text check ("frequency" in ('session', 'days', 'until_closed')) not null default 'days', "frequency_days" integer null, "layout" text check ("layout" in ('modal', 'corner')) not null default 'modal', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "popup_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_popup_deleted_at" ON "popup" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_popup_is_active" ON "popup" ("is_active") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `create table if not exists "popup_metric" ("id" text not null, "popup_id" text not null, "day" text not null, "impressions" integer not null default 0, "clicks" integer not null default 0, "closes" integer not null default 0, "signups" integer not null default 0, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "popup_metric_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_popup_metric_deleted_at" ON "popup_metric" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_popup_metric_popup_id_day_unique" ON "popup_metric" ("popup_id", "day") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "popup" cascade;`)

    this.addSql(`drop table if exists "popup_metric" cascade;`)
  }
}
