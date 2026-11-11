import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261111032640 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "plan_document" drop constraint if exists "plan_document_tenant_id_serial_unique";`
    )
    this.addSql(
      `create table if not exists "plan_document" ("id" text not null, "tenant_id" text not null, "serial" integer not null, "document" jsonb not null, "content_hash" text not null, "kid" text not null, "signature" text not null, "issued_at" timestamptz not null, "push_status" text check ("push_status" in ('pending', 'delivered', 'failed', 'superseded')) not null default 'pending', "push_attempts" integer not null default 0, "push_error" text null, "pushed_at" timestamptz null, "next_push_at" timestamptz null, "pulled_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "plan_document_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_plan_document_deleted_at" ON "plan_document" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_plan_document_tenant_id_serial_unique" ON "plan_document" ("tenant_id", "serial") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_plan_document_push_due" ON "plan_document" ("next_push_at") WHERE push_status = 'pending' AND deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "plan_document" cascade;`)
  }
}
