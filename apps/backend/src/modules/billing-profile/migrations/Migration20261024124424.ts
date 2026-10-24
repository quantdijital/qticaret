import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261024124424 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table if not exists "billing_profile" ("id" text not null, "type" text check ("type" in ('individual', 'corporate')) not null, "legal_name" text not null, "tax_office" text null, "tax_id_kind" text check ("tax_id_kind" in ('tckn', 'vkn')) not null, "tax_id_encrypted" text not null, "tax_id_hash" text not null, "tax_id_last4" text not null, "key_version" integer not null default 1, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "billing_profile_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_billing_profile_deleted_at" ON "billing_profile" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_billing_profile_tax_id_hash" ON "billing_profile" ("tax_id_hash") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "billing_profile" cascade;`)
  }
}
