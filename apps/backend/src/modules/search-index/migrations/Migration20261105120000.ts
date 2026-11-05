import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/**
 * adr/0023 Ek 2026-11-05: whether a product is on sale now (`/kampanyalar`)
 * is a fact of its row, worked out when it is indexed from the price the
 * storefront shows (price lists and automatic promotions every shopper
 * gets, the ten-day rule). Every row already indexed is marked pending so
 * the minute job works it out; until then a row reads as not on sale.
 * `search_index_state` keeps what the minute job compared last (the
 * automatic promotions as they applied).
 */
export class Migration20261105120000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `ALTER TABLE "search_document" ADD COLUMN IF NOT EXISTS "on_sale" boolean NOT NULL DEFAULT false;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_search_document_on_sale" ON "search_document" ("product_id") WHERE "on_sale";`
    )
    this.addSql(`CREATE TABLE IF NOT EXISTS "search_index_state" (
      "key" text NOT NULL,
      "value" text NOT NULL,
      "updated_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "search_index_state_pkey" PRIMARY KEY ("key"));`)
    this.addSql(`INSERT INTO "search_pending" ("product_id")
      SELECT "product_id" FROM "search_document" ORDER BY "product_id"
      ON CONFLICT ("product_id") DO UPDATE
        SET "version" = "search_pending"."version" + 1, "queued_at" = now();`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "search_index_state" cascade;`)
    this.addSql(`drop index if exists "IDX_search_document_on_sale";`)
    this.addSql(`alter table "search_document" drop column if exists "on_sale";`)
  }
}
