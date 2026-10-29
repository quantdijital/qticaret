import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261029130700 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "statement_check" drop constraint if exists "statement_check_provider_day_test_mode_unique";`
    )
    this.addSql(`drop index if exists "IDX_statement_check_provider_day_unique";`)

    this.addSql(
      `alter table if exists "statement_check" add column if not exists "test_mode" boolean not null default false;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_statement_check_provider_day_test_mode_unique" ON "statement_check" ("provider", "day", "test_mode") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "IDX_statement_check_provider_day_test_mode_unique";`)
    this.addSql(`alter table if exists "statement_check" drop column if exists "test_mode";`)

    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_statement_check_provider_day_unique" ON "statement_check" ("provider", "day") WHERE deleted_at IS NULL;`
    )
  }
}
