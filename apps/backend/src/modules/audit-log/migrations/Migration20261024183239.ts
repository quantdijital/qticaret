import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261024183239 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table if not exists "audit_entry" ("id" text not null, "kind" text check ("kind" in ('mutation', 'sensitive_read', 'system')) not null, "actor_type" text null, "actor_id" text null, "action" text not null, "resource_type" text null, "resource_id" text null, "outcome" integer null, "changes" jsonb null, "request_id" text null, "ip" text null, "user_agent" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "audit_entry_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_audit_entry_deleted_at" ON "audit_entry" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_audit_entry_resource_type_resource_id" ON "audit_entry" ("resource_type", "resource_id") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_audit_entry_actor_id" ON "audit_entry" ("actor_id") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_audit_entry_created_at" ON "audit_entry" ("created_at") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "audit_entry" cascade;`)
  }
}
