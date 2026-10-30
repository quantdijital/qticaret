import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261030125240 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table if not exists "cookie_consent" ("id" text not null, "visitor_hash" text not null, "analytics" boolean not null, "marketing" boolean not null, "policy_version" integer null, "given_at" timestamptz not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "cookie_consent_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_cookie_consent_deleted_at" ON "cookie_consent" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_cookie_consent_visitor" ON "cookie_consent" ("visitor_hash", "given_at") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "cookie_consent" cascade;`)
  }
}
