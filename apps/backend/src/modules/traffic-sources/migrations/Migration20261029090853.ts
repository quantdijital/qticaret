import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261029090853 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "traffic_source" drop constraint if exists "traffic_source_cart_id_unique";`
    )
    this.addSql(
      `create table if not exists "traffic_source" ("id" text not null, "cart_id" text not null, "source" text check ("source" in ('organic_search', 'paid_search', 'social', 'paid_social', 'email', 'referral', 'direct')) not null, "utm_source" text null, "utm_medium" text null, "utm_campaign" text null, "referrer_host" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "traffic_source_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_traffic_source_deleted_at" ON "traffic_source" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_traffic_source_cart_id_unique" ON "traffic_source" ("cart_id") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "traffic_source" cascade;`)
  }
}
