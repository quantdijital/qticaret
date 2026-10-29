import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261029094450 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "statement_check" drop constraint if exists "statement_check_provider_day_unique";`
    )
    this.addSql(
      `create table if not exists "statement_check" ("id" text not null, "provider" text check ("provider" in ('paytr', 'iyzico')) not null, "day" text not null, "status" text check ("status" in ('matched', 'mismatched', 'failed')) not null, "matched" integer not null default 0, "sales" integer not null default 0, "issues" jsonb not null, "error_code" text null, "checked_at" timestamptz not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "statement_check_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_statement_check_deleted_at" ON "statement_check" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_statement_check_provider_day_unique" ON "statement_check" ("provider", "day") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_statement_check_day" ON "statement_check" ("day") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "statement_check" cascade;`)
  }
}
