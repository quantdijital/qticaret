import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261121200833 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "product_question" add column if not exists "author_kind" text check ("author_kind" in ('customer', 'shop')) not null default 'customer', add column if not exists "user_id" text null;`
    )
    this.addSql(
      `alter table if exists "product_question" alter column "customer_id" type text using ("customer_id"::text);`
    )
    this.addSql(
      `alter table if exists "product_question" alter column "customer_id" drop not null;`
    )
  }

  override async down(): Promise<void> {
    // The shop's own questions have no customer: they and their answers go before
    // "customer_id" is required again, or the column could not be made not null
    this.addSql(
      `delete from "product_answer" where "question_id" in (select "id" from "product_question" where "author_kind" = 'shop');`
    )
    this.addSql(`delete from "product_question" where "author_kind" = 'shop';`)
    this.addSql(
      `alter table if exists "product_question" drop column if exists "author_kind", drop column if exists "user_id";`
    )

    this.addSql(
      `alter table if exists "product_question" alter column "customer_id" type text using ("customer_id"::text);`
    )
    this.addSql(`alter table if exists "product_question" alter column "customer_id" set not null;`)
  }
}
