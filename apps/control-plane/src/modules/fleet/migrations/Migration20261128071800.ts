import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/** Ek C21: a usage report's optional setup checklist (yes/no facts); null for an older shop's. */
export class Migration20261128071800 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "usage_snapshot" add column if not exists "setup" jsonb null;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "usage_snapshot" drop column if exists "setup";`)
  }
}
