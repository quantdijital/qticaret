import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261025114042 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table if not exists "async_job" ("id" text not null, "type" text not null, "status" text check ("status" in ('queued', 'running', 'succeeded', 'failed', 'cancelled')) not null default 'queued', "attempt" integer not null default 0, "progress" integer not null default 0, "progress_key" text null, "heartbeat_at" timestamptz null, "input" jsonb null, "result_file_id" text null, "result_summary" jsonb null, "error_code" text null, "requested_by" text null, "started_at" timestamptz null, "finished_at" timestamptz null, "expires_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "async_job_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_async_job_deleted_at" ON "async_job" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_async_job_status_heartbeat_at" ON "async_job" ("status", "heartbeat_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_async_job_type_created_at" ON "async_job" ("type", "created_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_async_job_expires_at" ON "async_job" ("expires_at") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "async_job" cascade;`)
  }
}
