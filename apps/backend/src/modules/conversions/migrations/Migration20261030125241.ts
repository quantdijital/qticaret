import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261030125241 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "tracking_consent" add column if not exists "cookie_consent_id" text null;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "tracking_consent" drop column if exists "cookie_consent_id";`
    )
  }
}
