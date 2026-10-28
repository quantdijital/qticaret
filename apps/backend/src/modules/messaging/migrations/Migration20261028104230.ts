import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261028104230 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "message_suppression" drop constraint if exists "message_suppression_channel_recipient_hash_unique";`
    )
    this.addSql(
      `alter table if exists "message_consent" drop constraint if exists "message_consent_channel_recipient_hash_unique";`
    )
    this.addSql(
      `create table if not exists "message_consent" ("id" text not null, "channel" text check ("channel" in ('email', 'sms', 'call')) not null, "recipient_hash" text not null, "recipient_masked" text not null, "customer_id" text null, "status" text check ("status" in ('granted', 'revoked')) not null, "source" text check ("source" in ('checkout', 'account', 'panel', 'import', 'iys')) not null, "changed_at" timestamptz not null, "changed_by" text null, "iys_status" text check ("iys_status" in ('pending', 'sent', 'failed', 'not_required')) not null default 'pending', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "message_consent_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_message_consent_deleted_at" ON "message_consent" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_message_consent_channel_recipient_hash_unique" ON "message_consent" ("channel", "recipient_hash") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_message_consent_customer_id" ON "message_consent" ("customer_id") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `create table if not exists "message_consent_event" ("id" text not null, "consent_id" text not null, "channel" text check ("channel" in ('email', 'sms', 'call')) not null, "status" text check ("status" in ('granted', 'revoked')) not null, "source" text check ("source" in ('checkout', 'account', 'panel', 'import', 'iys')) not null, "changed_at" timestamptz not null, "changed_by" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "message_consent_event_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_message_consent_event_deleted_at" ON "message_consent_event" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_message_consent_event_consent_id" ON "message_consent_event" ("consent_id") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `create table if not exists "message_suppression" ("id" text not null, "channel" text check ("channel" in ('email', 'sms')) not null, "recipient_hash" text not null, "recipient_masked" text not null, "reason" text check ("reason" in ('bounce', 'complaint', 'manual')) not null, "source" text check ("source" in ('resend', 'netgsm', 'panel')) not null, "detail" text null, "created_by" text null, "removed_by" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "message_suppression_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_message_suppression_deleted_at" ON "message_suppression" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_message_suppression_channel_recipient_hash_unique" ON "message_suppression" ("channel", "recipient_hash") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "message_consent" cascade;`)

    this.addSql(`drop table if exists "message_consent_event" cascade;`)

    this.addSql(`drop table if exists "message_suppression" cascade;`)
  }
}
