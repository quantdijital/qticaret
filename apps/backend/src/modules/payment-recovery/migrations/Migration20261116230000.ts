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

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "payment_recovery" drop constraint if exists "payment_recovery_status_check";`
    )

    this.addSql(
      `alter table if exists "payment_recovery" add constraint "payment_recovery_status_check" check("status" in ('pending', 'refunded', 'failed'));`
    )
  }
}
