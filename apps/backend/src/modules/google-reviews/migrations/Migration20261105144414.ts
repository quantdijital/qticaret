import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261105144414 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "google_review" drop constraint if exists "google_review_review_id_unique";`
    )
    this.addSql(
      `create table if not exists "google_review" ("id" text not null, "review_id" text not null, "reviewer_name" text null, "reviewer_photo_url" text null, "rating" integer not null, "comment" text null, "written_at" timestamptz not null, "edited_at" timestamptz not null, "reply" text null, "replied_at" timestamptz null, "hidden" boolean not null default false, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "google_review_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_google_review_deleted_at" ON "google_review" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_google_review_review_id_unique" ON "google_review" ("review_id") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_google_review_written_at" ON "google_review" ("written_at") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `create table if not exists "google_review_location" ("id" text not null, "account" text not null, "location" text not null, "title" text not null, "address" text null, "maps_uri" text null, "new_review_uri" text null, "average_rating" real null, "total_review_count" integer null, "synced_at" timestamptz null, "sync_error" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "google_review_location_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_google_review_location_deleted_at" ON "google_review_location" ("deleted_at") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "google_review" cascade;`)

    this.addSql(`drop table if exists "google_review_location" cascade;`)
  }
}
