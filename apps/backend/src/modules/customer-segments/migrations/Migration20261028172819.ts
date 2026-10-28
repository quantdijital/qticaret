import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261028172819 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "customer_segment" drop constraint if exists "customer_segment_customer_group_id_unique";`
    )
    this.addSql(
      `alter table if exists "customer_segment" drop constraint if exists "customer_segment_name_unique";`
    )
    this.addSql(
      `create table if not exists "customer_segment" ("id" text not null, "name" text not null, "rules" jsonb not null, "customer_group_id" text not null, "member_count" integer not null default 0, "refreshed_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "customer_segment_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_customer_segment_deleted_at" ON "customer_segment" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_customer_segment_name_unique" ON "customer_segment" ("name") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_customer_segment_customer_group_id_unique" ON "customer_segment" ("customer_group_id") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "customer_segment" cascade;`)
  }
}
