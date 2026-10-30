import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261030093707 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_tracked_shipment_tracking_number" ON "tracked_shipment" ("tracking_number") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "IDX_tracked_shipment_tracking_number";`)
  }
}
