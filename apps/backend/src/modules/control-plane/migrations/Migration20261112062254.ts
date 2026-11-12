import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261112062254 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "control_plane_marker" drop constraint if exists "control_plane_marker_tenant_id_unique";`
    )
    this.addSql(
      `create table if not exists "control_plane_marker" ("id" text not null, "tenant_id" text not null, "first_applied_at" timestamptz not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "control_plane_marker_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_control_plane_marker_deleted_at" ON "control_plane_marker" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_control_plane_marker_tenant_id_unique" ON "control_plane_marker" ("tenant_id") WHERE deleted_at IS NULL;`
    )
    // adr/0061 Ek C19 takip LOW-3: a shop already holding a document has applied one
    this.addSql(
      `insert into "control_plane_marker" ("id", "tenant_id", "first_applied_at") select 'cpmark_' || replace(gen_random_uuid()::text, '-', ''), "plan"."tenant_id", "plan"."received_at" from "control_plane_plan" as "plan" where "plan"."deleted_at" is null and not exists (select 1 from "control_plane_marker" as "marker" where "marker"."tenant_id" = "plan"."tenant_id" and "marker"."deleted_at" is null);`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "control_plane_marker" cascade;`)
  }
}
