import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261028145803 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "checkout_consent" drop constraint if exists "checkout_consent_cart_id_unique";`
    )
    this.addSql(
      `create table if not exists "checkout_consent" ("id" text not null, "cart_id" text not null, "email" boolean not null default false, "sms" boolean not null default false, "text_version" text not null, "ip_hash" text null, "given_at" timestamptz not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "checkout_consent_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_checkout_consent_deleted_at" ON "checkout_consent" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_checkout_consent_cart_id_unique" ON "checkout_consent" ("cart_id") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `alter table if exists "message_consent" drop constraint if exists "message_consent_source_check";`
    )

    this.addSql(
      `alter table if exists "message_consent_event" drop constraint if exists "message_consent_event_source_check";`
    )

    this.addSql(
      `alter table if exists "message_consent" add constraint "message_consent_source_check" check("source" in ('checkout', 'account', 'panel', 'import', 'iys', 'unsubscribe'));`
    )

    this.addSql(
      `alter table if exists "message_consent_event" add column if not exists "evidence" jsonb null;`
    )
    this.addSql(
      `alter table if exists "message_consent_event" add constraint "message_consent_event_source_check" check("source" in ('checkout', 'account', 'panel', 'import', 'iys', 'unsubscribe'));`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "checkout_consent" cascade;`)

    this.addSql(
      `alter table if exists "message_consent" drop constraint if exists "message_consent_source_check";`
    )

    this.addSql(
      `alter table if exists "message_consent_event" drop constraint if exists "message_consent_event_source_check";`
    )

    this.addSql(
      `alter table if exists "message_consent" add constraint "message_consent_source_check" check("source" in ('checkout', 'account', 'panel', 'import', 'iys'));`
    )

    this.addSql(`alter table if exists "message_consent_event" drop column if exists "evidence";`)

    this.addSql(
      `alter table if exists "message_consent_event" add constraint "message_consent_event_source_check" check("source" in ('checkout', 'account', 'panel', 'import', 'iys'));`
    )
  }
}
