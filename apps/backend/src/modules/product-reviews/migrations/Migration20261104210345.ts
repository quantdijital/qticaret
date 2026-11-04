import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261104210345 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table if not exists "product_review_photo" ("id" text not null, "review_id" text null, "product_id" text not null, "customer_id" text not null, "file_id" text not null, "url" text not null, "width" integer not null, "height" integer not null, "rank" integer not null default 0, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "product_review_photo_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_product_review_photo_deleted_at" ON "product_review_photo" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_product_review_photo_review_id" ON "product_review_photo" ("review_id") WHERE deleted_at IS NULL AND review_id IS NOT NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_product_review_photo_customer_id_product_id" ON "product_review_photo" ("customer_id", "product_id") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_product_review_photo_created_at" ON "product_review_photo" ("created_at") WHERE deleted_at IS NULL AND review_id IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "product_review_photo" cascade;`)
  }
}
