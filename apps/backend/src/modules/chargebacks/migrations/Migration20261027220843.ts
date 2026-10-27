import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261027220843 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "chargeback" drop constraint if exists "chargeback_payment_id_unique";`
    )
    this.addSql(`drop index if exists "IDX_chargeback_payment_id_status";`)

    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_chargeback_payment_id_unique" ON "chargeback" ("payment_id") WHERE status IN ('open', 'evidence_submitted') AND deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "IDX_chargeback_payment_id_unique";`)

    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_chargeback_payment_id_status" ON "chargeback" ("payment_id", "status") WHERE deleted_at IS NULL;`
    )
  }
}
