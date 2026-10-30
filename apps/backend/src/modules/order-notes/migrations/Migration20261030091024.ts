import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261030091024 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table if not exists "order_note" ("id" text not null, "order_id" text not null, "author_id" text not null, "body" text not null, "removed_by" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "order_note_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_order_note_deleted_at" ON "order_note" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_order_note_order_id_created_at" ON "order_note" ("order_id", "created_at") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "order_note" cascade;`)
  }
}
