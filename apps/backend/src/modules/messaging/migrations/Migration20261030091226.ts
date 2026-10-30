import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261030091226 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "message_skip" drop constraint if exists "message_skip_send_key_unique";`
    )
    this.addSql(
      `create table if not exists "message_skip" ("id" text not null, "send_key" text not null, "template" text not null, "channel" text check ("channel" in ('email', 'sms')) not null, "reason" text check ("reason" in ('channel_off', 'invalid_recipient', 'suppressed', 'no_consent', 'over_quota')) not null, "resource_type" text not null, "resource_id" text not null, "receiver_id" text null, "recipient_masked" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "message_skip_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_message_skip_deleted_at" ON "message_skip" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_message_skip_send_key_unique" ON "message_skip" ("send_key") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_message_skip_resource_id" ON "message_skip" ("resource_id") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_message_skip_receiver_id" ON "message_skip" ("receiver_id") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_message_skip_updated_at" ON "message_skip" ("updated_at") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "message_skip" cascade;`)
  }
}
