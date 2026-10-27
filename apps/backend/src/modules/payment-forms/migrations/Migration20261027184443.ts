import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261027184443 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "payment_form" drop constraint if exists "payment_form_session_id_unique";`
    )
    this.addSql(
      `create table if not exists "payment_form" ("id" text not null, "provider" text not null, "session_id" text not null, "cart_id" text not null, "token" text not null, "status" text check ("status" in ('open', 'closed')) not null default 'open', "outcome" text null, "expires_at" timestamptz not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "payment_form_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_payment_form_deleted_at" ON "payment_form" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_payment_form_session_id_unique" ON "payment_form" ("session_id") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_payment_form_provider_status_created_at" ON "payment_form" ("provider", "status", "created_at") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "payment_form" cascade;`)
  }
}
