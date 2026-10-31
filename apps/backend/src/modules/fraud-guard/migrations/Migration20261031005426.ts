import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261031005426 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "fraud_review" drop constraint if exists "fraud_review_order_id_unique";`
    )
    this.addSql(
      `alter table if exists "fraud_block" drop constraint if exists "fraud_block_kind_match_unique";`
    )
    this.addSql(
      `create table if not exists "fraud_block" ("id" text not null, "kind" text check ("kind" in ('email', 'email_domain', 'phone', 'ip')) not null, "match" text not null, "display" text not null, "reason" text null, "created_by" text null, "expires_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "fraud_block_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_fraud_block_deleted_at" ON "fraud_block" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_fraud_block_kind_match_unique" ON "fraud_block" ("kind", "match") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `create table if not exists "fraud_review" ("id" text not null, "order_id" text not null, "score" integer not null, "reasons" jsonb not null, "status" text check ("status" in ('pending', 'approved', 'rejected')) not null default 'pending', "decided_by" text null, "decided_at" timestamptz null, "note" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "fraud_review_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_fraud_review_deleted_at" ON "fraud_review" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_fraud_review_order_id_unique" ON "fraud_review" ("order_id") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_fraud_review_status" ON "fraud_review" ("status") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "fraud_block" cascade;`)

    this.addSql(`drop table if exists "fraud_review" cascade;`)
  }
}
