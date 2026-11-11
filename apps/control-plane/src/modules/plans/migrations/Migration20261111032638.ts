import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261111032638 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "tenant_feature_override" drop constraint if exists "tenant_feature_override_tenant_id_key_unique";`
    )
    this.addSql(
      `alter table if exists "package_feature" drop constraint if exists "package_feature_package_id_key_unique";`
    )
    this.addSql(
      `create table if not exists "package_feature" ("id" text not null, "key" text not null, "enabled" boolean not null, "package_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "package_feature_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_package_feature_package_id" ON "package_feature" ("package_id") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_package_feature_deleted_at" ON "package_feature" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_package_feature_package_id_key_unique" ON "package_feature" ("package_id", "key") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `create table if not exists "tenant_feature_override" ("id" text not null, "tenant_id" text not null, "key" text not null, "enabled" boolean not null, "reason" text not null, "expires_at" timestamptz null, "created_by" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "tenant_feature_override_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_tenant_feature_override_deleted_at" ON "tenant_feature_override" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_tenant_feature_override_tenant_id_key_unique" ON "tenant_feature_override" ("tenant_id", "key") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `alter table if exists "package_feature" add constraint "package_feature_package_id_foreign" foreign key ("package_id") references "package" ("id") on update cascade on delete cascade;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "package_feature" cascade;`)

    this.addSql(`drop table if exists "tenant_feature_override" cascade;`)
  }
}
