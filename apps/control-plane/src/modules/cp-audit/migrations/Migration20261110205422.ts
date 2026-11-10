import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261110205422 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table if not exists "cp_audit_entry" ("id" text not null, "kind" text check ("kind" in ('mutation', 'sensitive_read', 'system')) not null, "actor_type" text null, "actor_id" text null, "action" text not null, "resource_type" text null, "resource_id" text null, "outcome" integer null, "changes" jsonb null, "request_id" text null, "ip_hash" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "cp_audit_entry_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_cp_audit_entry_deleted_at" ON "cp_audit_entry" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_cp_audit_entry_resource_type_resource_id" ON "cp_audit_entry" ("resource_type", "resource_id") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_cp_audit_entry_actor_id" ON "cp_audit_entry" ("actor_id") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_cp_audit_entry_created_at" ON "cp_audit_entry" ("created_at") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "cp_audit_entry" cascade;`)
  }
}
