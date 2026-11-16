import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/**
 * The cart whose completion holds a link (adr/0051 §5): of two carts of
 * one link completing at once, the one that writes its id here first
 * becomes the order; the other is refused before any order is made.
 * `claim_token` names the completion run, so only it lets go. Nullable
 * columns with no default: no rewrite of the table.
 */
export class Migration20261116210000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "payment_link" add column if not exists "claimed_cart_id" text null, add column if not exists "claimed_at" timestamptz null, add column if not exists "claim_token" text null;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "payment_link" drop column if exists "claimed_cart_id", drop column if exists "claimed_at", drop column if exists "claim_token";`
    )
  }
}
