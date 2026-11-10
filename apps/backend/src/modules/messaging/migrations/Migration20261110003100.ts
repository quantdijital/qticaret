import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261110003100 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "message_template_text" drop constraint if exists "message_template_text_template_unique";`
    )
    this.addSql(
      `create table if not exists "message_template_text" ("id" text not null, "template" text not null, "enabled" boolean not null default true, "subject" text null, "preheader" text null, "heading" text null, "intro" text null, "sms" text null, "updated_by" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "message_template_text_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_message_template_text_deleted_at" ON "message_template_text" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_message_template_text_template_unique" ON "message_template_text" ("template") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "message_template_text" cascade;`)
  }
}
