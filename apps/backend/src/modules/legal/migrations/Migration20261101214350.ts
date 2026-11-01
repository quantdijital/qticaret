import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261101214350 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "privacy_request" drop constraint if exists "privacy_request_channel_check";`
    )

    this.addSql(
      `alter table if exists "privacy_request" add constraint "privacy_request_channel_check" check("channel" in ('email', 'phone', 'letter', 'in_person', 'other', 'account'));`
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "privacy_request" drop constraint if exists "privacy_request_channel_check";`
    )

    this.addSql(
      `alter table if exists "privacy_request" add constraint "privacy_request_channel_check" check("channel" in ('email', 'phone', 'letter', 'in_person', 'other'));`
    )
  }
}
