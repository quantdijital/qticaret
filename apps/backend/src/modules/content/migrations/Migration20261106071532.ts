import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261106071532 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "content_author" drop constraint if exists "content_author_handle_unique";`
    )
    this.addSql(
      `create table if not exists "content_author" ("id" text not null, "name" text not null, "handle" text not null, "job_title" text null, "bio" text null, "image_url" text null, "website_url" text null, "linkedin_url" text null, "instagram_url" text null, "x_url" text null, "user_id" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "content_author_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_content_author_deleted_at" ON "content_author" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_content_author_handle_unique" ON "content_author" ("handle") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_content_author_user_id" ON "content_author" ("user_id") WHERE deleted_at IS NULL AND user_id IS NOT NULL;`
    )

    this.addSql(
      `alter table if exists "content_entry" add column if not exists "author_id" text null;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_content_entry_author_id" ON "content_entry" ("author_id") WHERE deleted_at IS NULL AND author_id IS NOT NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "content_author" cascade;`)

    this.addSql(`drop index if exists "IDX_content_entry_author_id";`)
    this.addSql(`alter table if exists "content_entry" drop column if exists "author_id";`)
  }
}
