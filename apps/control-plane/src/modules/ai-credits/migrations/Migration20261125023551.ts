import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/**
 * The AI credits' platform settings (adr/0085 K6, K7, K11, §2): one row
 * (`key` = 'platform', unique), its values held by the database too: the
 * day's cap 0 to 1,000,000, the bought credits' life 1 to 120 months, at
 * most 10 packs in an array, the routing an object. Down drops the table:
 * the defaults apply again (no money moves with it).
 */
export class Migration20261125023551 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "ai_credit_setting" drop constraint if exists "ai_credit_setting_key_unique";`
    )
    this.addSql(
      `create table if not exists "ai_credit_setting" ("id" text not null, "key" text check ("key" in ('platform')) not null, "daily_cap" integer not null, "purchased_lifetime_months" integer not null, "packs" jsonb not null, "routing" jsonb not null, "updated_by" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "ai_credit_setting_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_ai_credit_setting_deleted_at" ON "ai_credit_setting" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_ai_credit_setting_key_unique" ON "ai_credit_setting" ("key") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `alter table "ai_credit_setting" add constraint "ai_credit_setting_values_check" check (
         "daily_cap" between 0 and 1000000
         and "purchased_lifetime_months" between 1 and 120
         and jsonb_typeof("packs") = 'array' and jsonb_array_length("packs") <= 10
         and jsonb_typeof("routing") = 'object'
       );`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "ai_credit_setting" cascade;`)
  }
}
