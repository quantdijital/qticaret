import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261028212717 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "cart_reminder" drop constraint if exists "cart_reminder_cart_id_unique";`
    )
    this.addSql(
      `create table if not exists "cart_reminder" ("id" text not null, "cart_id" text not null, "outcome" text not null, "token_hash" text null, "expires_at" timestamptz null, "returned_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "cart_reminder_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_cart_reminder_deleted_at" ON "cart_reminder" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_cart_reminder_cart_id_unique" ON "cart_reminder" ("cart_id") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_cart_reminder_token_hash" ON "cart_reminder" ("token_hash") WHERE deleted_at IS NULL AND token_hash IS NOT NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_cart_reminder_created_at" ON "cart_reminder" ("created_at") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "cart_reminder" cascade;`)
  }
}
