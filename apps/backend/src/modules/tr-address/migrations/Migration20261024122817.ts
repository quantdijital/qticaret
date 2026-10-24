import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261024122817 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "tr_neighborhood" drop constraint if exists "tr_neighborhood_district_id_match_key_unique";`
    )
    this.addSql(
      `alter table if exists "tr_district" drop constraint if exists "tr_district_province_id_match_key_unique";`
    )
    this.addSql(
      `alter table if exists "tr_province" drop constraint if exists "tr_province_code_unique";`
    )
    this.addSql(
      `create table if not exists "tr_province" ("id" text not null, "code" text not null, "name" text not null, "match_key" text not null, "sort_key" text not null, "is_active" boolean not null default true, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "tr_province_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_tr_province_deleted_at" ON "tr_province" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_tr_province_code_unique" ON "tr_province" ("code") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_tr_province_match_key" ON "tr_province" ("match_key") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `create table if not exists "tr_district" ("id" text not null, "name" text not null, "match_key" text not null, "sort_key" text not null, "is_active" boolean not null default true, "province_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "tr_district_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_tr_district_province_id" ON "tr_district" ("province_id") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_tr_district_deleted_at" ON "tr_district" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_tr_district_province_id_match_key_unique" ON "tr_district" ("province_id", "match_key") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `create table if not exists "tr_neighborhood" ("id" text not null, "name" text not null, "postal_code" text not null, "match_key" text not null, "sort_key" text not null, "is_active" boolean not null default true, "district_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "tr_neighborhood_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_tr_neighborhood_district_id" ON "tr_neighborhood" ("district_id") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_tr_neighborhood_deleted_at" ON "tr_neighborhood" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_tr_neighborhood_district_id_match_key_unique" ON "tr_neighborhood" ("district_id", "match_key") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `alter table if exists "tr_district" add constraint "tr_district_province_id_foreign" foreign key ("province_id") references "tr_province" ("id") on update cascade;`
    )

    this.addSql(
      `alter table if exists "tr_neighborhood" add constraint "tr_neighborhood_district_id_foreign" foreign key ("district_id") references "tr_district" ("id") on update cascade;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "tr_district" drop constraint if exists "tr_district_province_id_foreign";`
    )

    this.addSql(
      `alter table if exists "tr_neighborhood" drop constraint if exists "tr_neighborhood_district_id_foreign";`
    )

    this.addSql(`drop table if exists "tr_province" cascade;`)

    this.addSql(`drop table if exists "tr_district" cascade;`)

    this.addSql(`drop table if exists "tr_neighborhood" cascade;`)
  }
}
