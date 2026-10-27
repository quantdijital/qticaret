import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261027073631 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "integration_credential" drop constraint if exists "integration_credential_verification_check";`
    )

    this.addSql(
      `alter table if exists "integration_credential" add constraint "integration_credential_verification_check" check("verification" in ('verified', 'unverified', 'rejected'));`
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "integration_credential" drop constraint if exists "integration_credential_verification_check";`
    )

    this.addSql(
      `alter table if exists "integration_credential" add constraint "integration_credential_verification_check" check("verification" in ('verified', 'unverified'));`
    )
  }
}
