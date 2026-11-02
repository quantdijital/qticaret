import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261102201858 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "contact_message" drop constraint if exists "contact_message_subject_check";`
    )

    this.addSql(
      `alter table if exists "contact_message" add constraint "contact_message_subject_check" check("subject" in ('order', 'product', 'return', 'payment', 'kvkk', 'other'));`
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "contact_message" drop constraint if exists "contact_message_subject_check";`
    )

    this.addSql(
      `alter table if exists "contact_message" add constraint "contact_message_subject_check" check("subject" in ('order', 'product', 'return', 'payment', 'other'));`
    )
  }
}
