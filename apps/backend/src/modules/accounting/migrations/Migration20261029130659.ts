import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261029130659 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "accounting_sync" drop constraint if exists "accounting_sync_source_type_check";`
    )
    this.addSql(
      `alter table if exists "accounting_sync" drop constraint if exists "accounting_sync_status_check";`
    )

    this.addSql(
      `alter table if exists "accounting_sync" add constraint "accounting_sync_source_type_check" check("source_type" in ('sale', 'payment', 'refund', 'cancel'));`
    )
    this.addSql(
      `alter table if exists "accounting_sync" add constraint "accounting_sync_status_check" check("status" in ('pending', 'synced', 'stopped', 'skipped'));`
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "accounting_sync" drop constraint if exists "accounting_sync_source_type_check";`
    )
    this.addSql(
      `alter table if exists "accounting_sync" drop constraint if exists "accounting_sync_status_check";`
    )

    this.addSql(
      `alter table if exists "accounting_sync" add constraint "accounting_sync_source_type_check" check("source_type" in ('sale', 'payment', 'refund'));`
    )
    this.addSql(
      `alter table if exists "accounting_sync" add constraint "accounting_sync_status_check" check("status" in ('pending', 'synced', 'stopped'));`
    )
  }
}
