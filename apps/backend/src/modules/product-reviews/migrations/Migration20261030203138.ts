import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261030203138 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "product_review" add column if not exists "origin" text check ("origin" in ('storefront', 'migration')) not null default 'storefront';`
    )
    this.addSql(
      `alter table if exists "product_review" alter column "customer_id" type text using ("customer_id"::text);`
    )
    this.addSql(`alter table if exists "product_review" alter column "customer_id" drop not null;`)
    this.addSql(
      `alter table if exists "product_review" alter column "order_id" type text using ("order_id"::text);`
    )
    this.addSql(`alter table if exists "product_review" alter column "order_id" drop not null;`)
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "product_review" drop column if exists "origin";`)

    this.addSql(
      `alter table if exists "product_review" alter column "customer_id" type text using ("customer_id"::text);`
    )
    this.addSql(`alter table if exists "product_review" alter column "customer_id" set not null;`)
    this.addSql(
      `alter table if exists "product_review" alter column "order_id" type text using ("order_id"::text);`
    )
    this.addSql(`alter table if exists "product_review" alter column "order_id" set not null;`)
  }
}
