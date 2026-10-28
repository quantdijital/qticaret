import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261028194119 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table if not exists "product_answer" ("id" text not null, "question_id" text not null, "product_id" text not null, "author_kind" text check ("author_kind" in ('shop', 'customer')) not null, "customer_id" text null, "user_id" text null, "author_name" text not null, "body" text not null, "status" text check ("status" in ('pending', 'approved', 'rejected')) not null default 'pending', "has_link" boolean not null default false, "moderated_by" text null, "moderated_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "product_answer_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_product_answer_deleted_at" ON "product_answer" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_product_answer_question_id_status" ON "product_answer" ("question_id", "status") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_product_answer_status" ON "product_answer" ("status") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `create table if not exists "product_question" ("id" text not null, "product_id" text not null, "customer_id" text not null, "author_name" text not null, "body" text not null, "status" text check ("status" in ('pending', 'approved', 'rejected')) not null default 'pending', "has_link" boolean not null default false, "answer_count" integer not null default 0, "moderated_by" text null, "moderated_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "product_question_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_product_question_deleted_at" ON "product_question" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_product_question_product_id_status" ON "product_question" ("product_id", "status") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_product_question_status" ON "product_question" ("status") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "product_answer" cascade;`)

    this.addSql(`drop table if exists "product_question" cascade;`)
  }
}
