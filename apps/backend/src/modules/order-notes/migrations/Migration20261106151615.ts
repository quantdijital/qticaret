import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261106151615 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "customer_note" drop constraint if exists "customer_note_customer_id_unique";`
    )
    this.addSql(
      `create table if not exists "customer_note" ("id" text not null, "customer_id" text not null, "body" text not null, "updated_by" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "customer_note_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_customer_note_deleted_at" ON "customer_note" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_customer_note_customer_id_unique" ON "customer_note" ("customer_id") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "customer_note" cascade;`)
  }
}
