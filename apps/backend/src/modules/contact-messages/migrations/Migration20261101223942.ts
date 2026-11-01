import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261101223942 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table if not exists "contact_message" ("id" text not null, "customer_id" text null, "subject" text check ("subject" in ('order', 'product', 'return', 'payment', 'other')) not null, "order_number" text null, "email_hash" text not null, "sealed" text not null, "status" text check ("status" in ('new', 'handled')) not null default 'new', "handled_by" text null, "handled_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "contact_message_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_contact_message_deleted_at" ON "contact_message" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_contact_message_status_created_at" ON "contact_message" ("status", "created_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_contact_message_email_hash" ON "contact_message" ("email_hash") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_contact_message_customer_id" ON "contact_message" ("customer_id") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "contact_message" cascade;`)
  }
}
