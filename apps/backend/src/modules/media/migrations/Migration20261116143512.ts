import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261116143512 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table if not exists "media_video" ("id" text not null, "kind" text check ("kind" in ('upload', 'youtube')) not null, "status" text check ("status" in ('uploaded', 'processing', 'ready', 'failed')) not null default 'uploaded', "source_file_id" text null, "source_bytes" integer null, "source_format" text check ("source_format" in ('mp4', 'mov', 'webm', 'gif')) null, "youtube_id" text null, "title" text null, "position" integer not null default 1, "width" integer null, "height" integer null, "duration_ms" integer null, "outputs" jsonb null, "output_file_ids" text[] null, "poster" jsonb null, "poster_file_ids" text[] null, "stored_bytes" integer not null default 0, "error_code" text null, "attempts" integer not null default 0, "heartbeat_at" timestamptz null, "processed_at" timestamptz null, "uploaded_by" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "media_video_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_media_video_deleted_at" ON "media_video" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_media_video_status_created_at" ON "media_video" ("status", "created_at") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "media_video" cascade;`)
  }
}
