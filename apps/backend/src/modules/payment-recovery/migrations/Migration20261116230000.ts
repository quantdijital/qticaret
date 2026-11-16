import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261116230000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "payment_recovery" drop constraint if exists "payment_recovery_status_check";`
    )

    this.addSql(
      `alter table if exists "payment_recovery" add constraint "payment_recovery_status_check" check("status" in ('pending', 'refunded', 'failed', 'order_exists'));`
    )
  }

  // Refused while an `order_exists` row stands: on purpose, no status is safe to fold it into
  // (`failed` asks the shop to refund a placed order's money by hand)
  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "payment_recovery" drop constraint if exists "payment_recovery_status_check";`
    )

    this.addSql(
      `alter table if exists "payment_recovery" add constraint "payment_recovery_status_check" check("status" in ('pending', 'refunded', 'failed'));`
    )
  }
}
