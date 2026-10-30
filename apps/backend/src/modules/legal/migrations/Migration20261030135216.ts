import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261030135216 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table if not exists "privacy_request" ("id" text not null, "customer_id" text not null, "kind" text check ("kind" in ('export', 'erasure')) not null, "channel" text check ("channel" in ('email', 'phone', 'letter', 'in_person', 'other')) not null, "received_at" timestamptz not null, "recorded_by" text not null, "status" text check ("status" in ('open', 'completed', 'rejected')) not null default 'open', "job_id" text null, "completed_at" timestamptz null, "completed_by" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "privacy_request_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_privacy_request_deleted_at" ON "privacy_request" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_privacy_request_customer" ON "privacy_request" ("customer_id") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "privacy_request" cascade;`)
  }
}
