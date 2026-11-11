import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261110235654 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "tenant_domain" drop constraint if exists "tenant_domain_hostname_unique";`
    )
    this.addSql(
      `alter table if exists "tenant_company" drop constraint if exists "tenant_company_tenant_id_unique";`
    )
    this.addSql(`alter table if exists "tenant" drop constraint if exists "tenant_slug_unique";`)
    this.addSql(
      `create table if not exists "tenant" ("id" text not null, "slug" text not null, "name" text not null, "status" text check ("status" in ('provisioning', 'active', 'restricted', 'suspended', 'closing', 'closed')) not null default 'provisioning', "status_changed_at" timestamptz not null, "sector_pack" text null, "created_by" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "tenant_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_tenant_deleted_at" ON "tenant" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_tenant_slug_unique" ON "tenant" ("slug") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_tenant_status" ON "tenant" ("status") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_tenant_created_at" ON "tenant" ("created_at") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `create table if not exists "tenant_company" ("id" text not null, "kind" text check ("kind" in ('company', 'sole_proprietor')) not null default 'company', "legal_name" text null, "tax_office" text null, "tax_number" text null, "tckn_sealed" text null, "tckn_last4" text null, "address_line" text null, "district" text null, "city" text null, "postal_code" text null, "country_code" text not null default 'TR', "tenant_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "tenant_company_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_tenant_company_tenant_id_unique" ON "tenant_company" ("tenant_id") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_tenant_company_deleted_at" ON "tenant_company" ("deleted_at") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `create table if not exists "tenant_contact" ("id" text not null, "name" text not null, "role" text check ("role" in ('owner', 'billing', 'technical')) not null, "email" text not null, "phone" text null, "is_primary_billing" boolean not null default false, "tenant_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "tenant_contact_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_tenant_contact_tenant_id" ON "tenant_contact" ("tenant_id") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_tenant_contact_deleted_at" ON "tenant_contact" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_tenant_contact_primary_billing" ON "tenant_contact" ("tenant_id") WHERE is_primary_billing = true AND deleted_at IS NULL;`
    )

    this.addSql(
      `create table if not exists "tenant_domain" ("id" text not null, "hostname" text not null, "kind" text check ("kind" in ('platform_subdomain', 'custom')) not null, "verification" text check ("verification" in ('pending', 'verified', 'failed')) not null default 'pending', "is_primary" boolean not null default false, "tenant_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "tenant_domain_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_tenant_domain_tenant_id" ON "tenant_domain" ("tenant_id") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_tenant_domain_deleted_at" ON "tenant_domain" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_tenant_domain_hostname_unique" ON "tenant_domain" ("hostname") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_tenant_domain_primary" ON "tenant_domain" ("tenant_id") WHERE is_primary = true AND deleted_at IS NULL;`
    )

    this.addSql(
      `create table if not exists "tenant_note" ("id" text not null, "body" text not null, "pinned" boolean not null default false, "author_id" text null, "tenant_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "tenant_note_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_tenant_note_tenant_id" ON "tenant_note" ("tenant_id") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_tenant_note_deleted_at" ON "tenant_note" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_tenant_note_tenant_id_created_at" ON "tenant_note" ("tenant_id", "created_at") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `create table if not exists "tenant_status_change" ("id" text not null, "from_status" text check ("from_status" in ('provisioning', 'active', 'restricted', 'suspended', 'closing', 'closed')) null, "to_status" text check ("to_status" in ('provisioning', 'active', 'restricted', 'suspended', 'closing', 'closed')) not null, "reason_code" text not null, "actor" text not null, "tenant_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "tenant_status_change_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_tenant_status_change_tenant_id" ON "tenant_status_change" ("tenant_id") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_tenant_status_change_deleted_at" ON "tenant_status_change" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_tenant_status_change_tenant_id_created_at" ON "tenant_status_change" ("tenant_id", "created_at") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `alter table if exists "tenant_company" add constraint "tenant_company_tenant_id_foreign" foreign key ("tenant_id") references "tenant" ("id") on update cascade on delete cascade;`
    )

    this.addSql(
      `alter table if exists "tenant_contact" add constraint "tenant_contact_tenant_id_foreign" foreign key ("tenant_id") references "tenant" ("id") on update cascade on delete cascade;`
    )

    this.addSql(
      `alter table if exists "tenant_domain" add constraint "tenant_domain_tenant_id_foreign" foreign key ("tenant_id") references "tenant" ("id") on update cascade on delete cascade;`
    )

    this.addSql(
      `alter table if exists "tenant_note" add constraint "tenant_note_tenant_id_foreign" foreign key ("tenant_id") references "tenant" ("id") on update cascade on delete cascade;`
    )

    this.addSql(
      `alter table if exists "tenant_status_change" add constraint "tenant_status_change_tenant_id_foreign" foreign key ("tenant_id") references "tenant" ("id") on update cascade on delete cascade;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "tenant_company" drop constraint if exists "tenant_company_tenant_id_foreign";`
    )

    this.addSql(
      `alter table if exists "tenant_contact" drop constraint if exists "tenant_contact_tenant_id_foreign";`
    )

    this.addSql(
      `alter table if exists "tenant_domain" drop constraint if exists "tenant_domain_tenant_id_foreign";`
    )

    this.addSql(
      `alter table if exists "tenant_note" drop constraint if exists "tenant_note_tenant_id_foreign";`
    )

    this.addSql(
      `alter table if exists "tenant_status_change" drop constraint if exists "tenant_status_change_tenant_id_foreign";`
    )

    this.addSql(`drop table if exists "tenant" cascade;`)

    this.addSql(`drop table if exists "tenant_company" cascade;`)

    this.addSql(`drop table if exists "tenant_contact" cascade;`)

    this.addSql(`drop table if exists "tenant_domain" cascade;`)

    this.addSql(`drop table if exists "tenant_note" cascade;`)

    this.addSql(`drop table if exists "tenant_status_change" cascade;`)
  }
}
