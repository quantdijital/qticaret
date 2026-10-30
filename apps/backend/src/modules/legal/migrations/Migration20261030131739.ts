import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261030131739 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table if not exists "age_declaration" ("id" text not null, "cart_id" text not null, "min_age" integer not null, "declared_at" timestamptz not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "age_declaration_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_age_declaration_deleted_at" ON "age_declaration" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_age_declaration_cart" ON "age_declaration" ("cart_id") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "age_declaration" cascade;`)
  }
}
