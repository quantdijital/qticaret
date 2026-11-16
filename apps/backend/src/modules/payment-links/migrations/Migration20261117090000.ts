import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/**
 * The carts opened from links (`payment_link_cart`): a link's carts are
 * found here by its id instead of by a JSON key of Medusa's `cart` table,
 * which has no index for it and is not ours to change. Existing carts are
 * filled in by `migration-scripts/payment-link-carts.ts`, which `db:migrate`
 * runs after this.
 */
export class Migration20261117090000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table if not exists "payment_link_cart" ("id" text not null, "link_id" text not null, "cart_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "payment_link_cart_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_payment_link_cart_deleted_at" ON "payment_link_cart" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_payment_link_cart_link_id_cart_id_unique" ON "payment_link_cart" ("link_id", "cart_id") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_payment_link_cart_link_id" ON "payment_link_cart" ("link_id") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_payment_link_cart_cart_id" ON "payment_link_cart" ("cart_id") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "payment_link_cart" cascade;`)
  }
}
