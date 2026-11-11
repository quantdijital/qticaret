import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261111033457 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "control_plane_plan" drop constraint if exists "control_plane_plan_tenant_id_unique";`
    )
    this.addSql(
      `create table if not exists "control_plane_plan" ("id" text not null, "tenant_id" text not null, "serial" integer not null, "document" jsonb not null, "kid" text not null, "signature" text not null, "received_at" timestamptz not null, "confirmed_at" timestamptz not null, "source" text check ("source" in ('push', 'pull')) not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "control_plane_plan_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_control_plane_plan_deleted_at" ON "control_plane_plan" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_control_plane_plan_tenant_id_unique" ON "control_plane_plan" ("tenant_id") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "control_plane_plan" cascade;`)
  }
}
