import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261030180110 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "parasut_connection" drop constraint if exists "parasut_connection_slot_unique";`
    )
    this.addSql(
      `create table if not exists "parasut_connection" ("id" text not null, "slot" text not null default 'parasut', "company_id" text not null, "access_token_encrypted" text not null, "refresh_token_encrypted" text not null, "access_expires_at" timestamptz not null, "status" text check ("status" in ('connected', 'broken')) not null default 'connected', "last_error" text null, "connected_by" text null, "connected_at" timestamptz not null, "checked_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "parasut_connection_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_parasut_connection_deleted_at" ON "parasut_connection" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_parasut_connection_slot_unique" ON "parasut_connection" ("slot") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "parasut_connection" cascade;`)
  }
}
