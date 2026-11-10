import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261110205421 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "cp_staff_member" drop constraint if exists "cp_staff_member_user_id_unique";`
    )
    this.addSql(
      `create table if not exists "cp_staff_member" ("id" text not null, "user_id" text not null, "role" text check ("role" in ('owner', 'operator', 'finance', 'readonly')) not null, "assigned_by" text null, "deactivated_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "cp_staff_member_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_cp_staff_member_deleted_at" ON "cp_staff_member" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_cp_staff_member_user_id_unique" ON "cp_staff_member" ("user_id") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "cp_staff_member" cascade;`)
  }
}
