import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261126231504 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "ptt_barcode_range" drop constraint if exists "ptt_barcode_range_first_number_unique";`
    )
    this.addSql(
      `create table if not exists "ptt_barcode_range" ("id" text not null, "first_number" text not null, "last_number" text not null, "next_number" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "ptt_barcode_range_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_ptt_barcode_range_deleted_at" ON "ptt_barcode_range" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_ptt_barcode_range_first_number_unique" ON "ptt_barcode_range" ("first_number") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "ptt_barcode_range" cascade;`)
  }
}
