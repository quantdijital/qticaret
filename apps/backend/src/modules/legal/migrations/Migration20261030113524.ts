import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261030113524 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "legal_document" drop constraint if exists "legal_document_kind_version_unique";`
    )
    this.addSql(
      `create table if not exists "legal_document" ("id" text not null, "kind" text check ("kind" in ('distance_sales', 'pre_information', 'privacy_notice', 'cookie_policy', 'return_policy', 'shipping_policy', 'membership')) not null, "version" integer not null, "status" text check ("status" in ('draft', 'published', 'retired')) not null default 'draft', "title" text not null, "body" jsonb not null, "body_hash" text null, "created_by" text null, "published_at" timestamptz null, "published_by" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "legal_document_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_legal_document_deleted_at" ON "legal_document" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_legal_document_kind_version_unique" ON "legal_document" ("kind", "version") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_legal_document_one_draft" ON "legal_document" ("kind") WHERE status = 'draft' AND deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_legal_document_one_published" ON "legal_document" ("kind") WHERE status = 'published' AND deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "legal_document" cascade;`)
  }
}
