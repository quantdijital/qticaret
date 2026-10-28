import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261028120742 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table if not exists "sender_domain" ("id" text not null, "name" text not null, "local_part" text not null default 'bildirim', "resend_id" text not null, "status" text check ("status" in ('not_started', 'pending', 'verified', 'failure', 'temporary_failure')) not null, "records" jsonb not null, "checked_at" timestamptz null, "verified_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "sender_domain_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_sender_domain_deleted_at" ON "sender_domain" ("deleted_at") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "sender_domain" cascade;`)
  }
}
