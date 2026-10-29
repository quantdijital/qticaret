import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261029004158 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "tracking_consent" drop constraint if exists "tracking_consent_order_id_unique";`
    )
    this.addSql(
      `alter table if exists "tracking_consent" drop constraint if exists "tracking_consent_cart_id_unique";`
    )
    this.addSql(
      `alter table if exists "conversion_event" drop constraint if exists "conversion_event_event_key_unique";`
    )
    this.addSql(
      `create table if not exists "conversion_event" ("id" text not null, "event_key" text not null, "target" text not null, "kind" text not null, "order_id" text not null, "amount" integer null, "status" text check ("status" in ('pending', 'sent', 'failed')) not null, "attempts" integer not null default 0, "error" text null, "sent_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "conversion_event_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_conversion_event_deleted_at" ON "conversion_event" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_conversion_event_event_key_unique" ON "conversion_event" ("event_key") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_conversion_event_status_created_at" ON "conversion_event" ("status", "created_at") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `create table if not exists "tracking_consent" ("id" text not null, "cart_id" text null, "order_id" text null, "analytics" boolean not null, "marketing" boolean not null, "given_at" timestamptz not null, "ga_client_id" text null, "fbp" text null, "fbc" text null, "page_url" text null, "client_encrypted" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "tracking_consent_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_tracking_consent_deleted_at" ON "tracking_consent" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_tracking_consent_cart_id_unique" ON "tracking_consent" ("cart_id") WHERE deleted_at IS NULL AND cart_id IS NOT NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_tracking_consent_order_id_unique" ON "tracking_consent" ("order_id") WHERE deleted_at IS NULL AND order_id IS NOT NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "conversion_event" cascade;`)

    this.addSql(`drop table if exists "tracking_consent" cascade;`)
  }
}
