import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261110235656 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "tenant_plan" drop constraint if exists "tenant_plan_tenant_id_unique";`
    )
    this.addSql(
      `alter table if exists "tenant_override" drop constraint if exists "tenant_override_tenant_id_key_unique";`
    )
    this.addSql(
      `alter table if exists "package_limit" drop constraint if exists "package_limit_package_id_key_unique";`
    )
    this.addSql(`alter table if exists "package" drop constraint if exists "package_code_unique";`)
    this.addSql(
      `create table if not exists "package" ("id" text not null, "code" text not null, "name" text not null, "price" integer not null, "currency_code" text not null default 'TRY', "period" text check ("period" in ('monthly', 'yearly')) not null, "trial_days" integer not null default 0, "grace_days" integer not null default 7, "archived_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "package_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_package_deleted_at" ON "package" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_package_code_unique" ON "package" ("code") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `create table if not exists "package_limit" ("id" text not null, "key" text check ("key" in ('products', 'orders_per_month', 'staff', 'storage_mb', 'llm_credits_per_month', 'custom_domains')) not null, "value" integer null, "package_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "package_limit_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_package_limit_package_id" ON "package_limit" ("package_id") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_package_limit_deleted_at" ON "package_limit" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_package_limit_package_id_key_unique" ON "package_limit" ("package_id", "key") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `create table if not exists "tenant_override" ("id" text not null, "tenant_id" text not null, "key" text check ("key" in ('products', 'orders_per_month', 'staff', 'storage_mb', 'llm_credits_per_month', 'custom_domains')) not null, "value" integer null, "reason" text not null, "expires_at" timestamptz null, "created_by" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "tenant_override_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_tenant_override_deleted_at" ON "tenant_override" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_tenant_override_tenant_id_key_unique" ON "tenant_override" ("tenant_id", "key") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `create table if not exists "tenant_plan" ("id" text not null, "tenant_id" text not null, "assigned_by" text null, "package_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "tenant_plan_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_tenant_plan_package_id" ON "tenant_plan" ("package_id") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_tenant_plan_deleted_at" ON "tenant_plan" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_tenant_plan_tenant_id_unique" ON "tenant_plan" ("tenant_id") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `alter table if exists "package_limit" add constraint "package_limit_package_id_foreign" foreign key ("package_id") references "package" ("id") on update cascade on delete cascade;`
    )

    this.addSql(
      `alter table if exists "tenant_plan" add constraint "tenant_plan_package_id_foreign" foreign key ("package_id") references "package" ("id") on update cascade;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "package_limit" drop constraint if exists "package_limit_package_id_foreign";`
    )

    this.addSql(
      `alter table if exists "tenant_plan" drop constraint if exists "tenant_plan_package_id_foreign";`
    )

    this.addSql(`drop table if exists "package" cascade;`)

    this.addSql(`drop table if exists "package_limit" cascade;`)

    this.addSql(`drop table if exists "tenant_override" cascade;`)

    this.addSql(`drop table if exists "tenant_plan" cascade;`)
  }
}
