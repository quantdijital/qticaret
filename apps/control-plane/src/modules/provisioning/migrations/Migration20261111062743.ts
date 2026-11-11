import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261111062743 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "provisioning_step" drop constraint if exists "provisioning_step_run_id_position_unique";`
    )
    this.addSql(
      `create table if not exists "provisioning_run" ("id" text not null, "tenant_id" text not null, "kind" text check ("kind" in ('create', 'upgrade', 'apply_pack', 'rotate_keys', 'stop', 'start', 'invite', 'close')) not null, "status" text check ("status" in ('running', 'succeeded', 'failed')) not null default 'running', "provider" text check ("provider" in ('local', 'docker', 'fake')) not null, "requested_by" text null, "port" integer null, "error_code" text null, "started_at" timestamptz not null, "finished_at" timestamptz null, "heartbeat_at" timestamptz not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "provisioning_run_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_provisioning_run_deleted_at" ON "provisioning_run" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_provisioning_run_tenant_id_started_at" ON "provisioning_run" ("tenant_id", "started_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_provisioning_run_one_running" ON "provisioning_run" ("tenant_id") WHERE status = 'running' AND deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_provisioning_run_port" ON "provisioning_run" ("port") WHERE port IS NOT NULL AND deleted_at IS NULL;`
    )

    this.addSql(
      `create table if not exists "provisioning_step" ("id" text not null, "name" text not null, "position" integer not null, "status" text check ("status" in ('pending', 'running', 'succeeded', 'skipped', 'failed', 'compensated')) not null default 'pending', "attempts" integer not null default 0, "created" boolean not null default false, "error_code" text null, "output" jsonb null, "started_at" timestamptz null, "finished_at" timestamptz null, "run_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "provisioning_step_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_provisioning_step_run_id" ON "provisioning_step" ("run_id") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_provisioning_step_deleted_at" ON "provisioning_step" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_provisioning_step_run_id_position_unique" ON "provisioning_step" ("run_id", "position") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `alter table if exists "provisioning_step" add constraint "provisioning_step_run_id_foreign" foreign key ("run_id") references "provisioning_run" ("id") on update cascade on delete cascade;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "provisioning_step" drop constraint if exists "provisioning_step_run_id_foreign";`
    )

    this.addSql(`drop table if exists "provisioning_run" cascade;`)

    this.addSql(`drop table if exists "provisioning_step" cascade;`)
  }
}
