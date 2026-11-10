import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261110061741 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "message_suppression" drop constraint if exists "message_suppression_source_check";`
    )

    this.addSql(
      `alter table if exists "message_suppression" add constraint "message_suppression_source_check" check("source" in ('resend', 'netgsm', 'panel', 'smtp'));`
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "message_suppression" drop constraint if exists "message_suppression_source_check";`
    )

    this.addSql(
      `alter table if exists "message_suppression" add constraint "message_suppression_source_check" check("source" in ('resend', 'netgsm', 'panel'));`
    )
  }
}
