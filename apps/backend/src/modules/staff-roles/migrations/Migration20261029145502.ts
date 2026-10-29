import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261029145502 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "staff_role" drop constraint if exists "staff_role_user_id_unique";`
    )
    this.addSql(
      `create table if not exists "staff_role" ("id" text not null, "user_id" text not null, "role" text check ("role" in ('owner', 'admin', 'operations', 'readonly')) not null, "assigned_by" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "staff_role_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_staff_role_deleted_at" ON "staff_role" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_staff_role_user_id_unique" ON "staff_role" ("user_id") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "staff_role" cascade;`)
  }
}
