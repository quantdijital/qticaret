import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261103061222 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "bulk_message_recipient" drop constraint if exists "bulk_message_recipient_campaign_id_recipient_hash_unique";`
    )
    this.addSql(
      `alter table if exists "bulk_message" drop constraint if exists "bulk_message_utm_campaign_unique";`
    )
    this.addSql(
      `create table if not exists "bulk_message" ("id" text not null, "name" text not null, "channel" text check ("channel" in ('email', 'sms')) not null, "audience" jsonb not null, "subject" text null, "preheader" text null, "body" jsonb null, "sms_text" text null, "utm_campaign" text not null, "status" text check ("status" in ('draft', 'scheduled', 'sending', 'paused', 'sent', 'cancelled', 'failed')) not null default 'draft', "paused_reason" text check ("paused_reason" in ('staff', 'quota', 'quiet_hours', 'complaints', 'channel_off')) null, "paused_day" text null, "failure_reason" text null, "scheduled_at" timestamptz null, "started_at" timestamptz null, "frozen_at" timestamptz null, "finished_at" timestamptz null, "recipients_pruned_at" timestamptz null, "created_by" text null, "sent_by" text null, "counts" jsonb not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "bulk_message_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_bulk_message_deleted_at" ON "bulk_message" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_bulk_message_utm_campaign_unique" ON "bulk_message" ("utm_campaign") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_bulk_message_status" ON "bulk_message" ("status") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `create table if not exists "bulk_message_recipient" ("id" text not null, "campaign_id" text not null, "recipient_hash" text not null, "source" text check ("source" in ('customer', 'consent')) not null, "source_id" text not null, "customer_id" text null, "status" text check ("status" in ('pending', 'sent', 'skipped', 'failed')) not null default 'pending', "reason" text null, "sent_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "bulk_message_recipient_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_bulk_message_recipient_deleted_at" ON "bulk_message_recipient" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_bulk_message_recipient_campaign_id_recipient_hash_unique" ON "bulk_message_recipient" ("campaign_id", "recipient_hash") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_bulk_message_recipient_campaign_id_status" ON "bulk_message_recipient" ("campaign_id", "status") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_bulk_message_recipient_sent_at" ON "bulk_message_recipient" ("sent_at") WHERE deleted_at IS NULL AND sent_at IS NOT NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_bulk_message_recipient_customer_id" ON "bulk_message_recipient" ("customer_id") WHERE deleted_at IS NULL AND customer_id IS NOT NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "bulk_message" cascade;`)

    this.addSql(`drop table if exists "bulk_message_recipient" cascade;`)
  }
}
