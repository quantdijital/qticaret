import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261028185751 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "product_review" drop constraint if exists "product_review_product_id_customer_id_unique";`
    )
    this.addSql(
      `alter table if exists "product_rating" drop constraint if exists "product_rating_product_id_unique";`
    )
    this.addSql(
      `create table if not exists "product_rating" ("id" text not null, "product_id" text not null, "review_count" integer not null default 0, "rating_total" integer not null default 0, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "product_rating_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_product_rating_deleted_at" ON "product_rating" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_product_rating_product_id_unique" ON "product_rating" ("product_id") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `create table if not exists "product_review" ("id" text not null, "product_id" text not null, "customer_id" text not null, "order_id" text not null, "rating" integer not null, "title" text null, "body" text not null, "author_name" text not null, "status" text check ("status" in ('pending', 'approved', 'rejected')) not null default 'pending', "has_link" boolean not null default false, "reject_reason" text null, "moderated_by" text null, "moderated_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "product_review_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_product_review_deleted_at" ON "product_review" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_product_review_product_id_customer_id_unique" ON "product_review" ("product_id", "customer_id") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_product_review_product_id_status" ON "product_review" ("product_id", "status") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_product_review_status" ON "product_review" ("status") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "product_rating" cascade;`)

    this.addSql(`drop table if exists "product_review" cascade;`)
  }
}
