import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261101231123 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "consent_request" drop constraint if exists "consent_request_source_check";`
    )

    this.addSql(
      `alter table if exists "message_consent" drop constraint if exists "message_consent_source_check";`
    )

    this.addSql(
      `alter table if exists "message_consent_event" drop constraint if exists "message_consent_event_source_check";`
    )

    this.addSql(
      `alter table if exists "consent_request" add constraint "consent_request_source_check" check("source" in ('checkout', 'account', 'newsletter'));`
    )

    this.addSql(
      `alter table if exists "message_consent" add constraint "message_consent_source_check" check("source" in ('checkout', 'account', 'panel', 'import', 'iys', 'unsubscribe', 'newsletter'));`
    )

    this.addSql(
      `alter table if exists "message_consent_event" add constraint "message_consent_event_source_check" check("source" in ('checkout', 'account', 'panel', 'import', 'iys', 'unsubscribe', 'newsletter'));`
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "consent_request" drop constraint if exists "consent_request_source_check";`
    )

    this.addSql(
      `alter table if exists "message_consent" drop constraint if exists "message_consent_source_check";`
    )

    this.addSql(
      `alter table if exists "message_consent_event" drop constraint if exists "message_consent_event_source_check";`
    )

    this.addSql(
      `alter table if exists "consent_request" add constraint "consent_request_source_check" check("source" in ('checkout', 'account'));`
    )

    this.addSql(
      `alter table if exists "message_consent" add constraint "message_consent_source_check" check("source" in ('checkout', 'account', 'panel', 'import', 'iys', 'unsubscribe'));`
    )

    this.addSql(
      `alter table if exists "message_consent_event" add constraint "message_consent_event_source_check" check("source" in ('checkout', 'account', 'panel', 'import', 'iys', 'unsubscribe'));`
    )
  }
}
