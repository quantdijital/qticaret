import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261029080730 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "consent_request" drop constraint if exists "consent_request_token_hash_unique";`
    )
    this.addSql(
      `create table if not exists "consent_request" ("id" text not null, "channel" text check ("channel" in ('email', 'sms')) not null, "recipient_hash" text not null, "recipient_encrypted" text not null, "status" text check ("status" in ('granted', 'revoked')) not null, "source" text check ("source" in ('checkout', 'account')) not null, "customer_id" text null, "evidence" jsonb null, "token_hash" text not null, "expires_at" timestamptz not null, "confirmed_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "consent_request_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_consent_request_deleted_at" ON "consent_request" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_consent_request_token_hash_unique" ON "consent_request" ("token_hash") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_consent_request_recipient_hash" ON "consent_request" ("recipient_hash") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "consent_request" cascade;`)
  }
}
