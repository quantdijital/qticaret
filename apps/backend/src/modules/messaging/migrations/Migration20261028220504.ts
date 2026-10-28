import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261028220504 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "message_consent" add column if not exists "recipient_encrypted" text null, add column if not exists "iys_error" text null, add column if not exists "iys_sent_at" timestamptz null;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_message_consent_iys_status_changed_at" ON "message_consent" ("iys_status", "changed_at") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "IDX_message_consent_iys_status_changed_at";`)
    this.addSql(
      `alter table if exists "message_consent" drop column if exists "recipient_encrypted", drop column if exists "iys_error", drop column if exists "iys_sent_at";`
    )
  }
}
