import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261025111345 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "attribute_definition" drop constraint if exists "attribute_definition_template_id_key_unique";`
    )
    this.addSql(
      `alter table if exists "attribute_template" drop constraint if exists "attribute_template_handle_unique";`
    )
    this.addSql(
      `create table if not exists "attribute_template" ("id" text not null, "name" text not null, "handle" text not null, "description" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "attribute_template_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_attribute_template_handle_unique" ON "attribute_template" ("handle") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_attribute_template_deleted_at" ON "attribute_template" ("deleted_at") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `create table if not exists "attribute_definition" ("id" text not null, "key" text not null, "label" text not null, "type" text check ("type" in ('text', 'number', 'boolean', 'select', 'multi_select')) not null, "unit" text null, "options" jsonb null, "rank" integer not null default 0, "is_required" boolean not null default false, "is_filterable" boolean not null default false, "is_seo_highlight" boolean not null default false, "scope" text check ("scope" in ('product', 'variant')) not null default 'product', "option_title" text null, "varies_by" text check ("varies_by" in ('color', 'size', 'suggestedAge', 'suggestedGender', 'material', 'pattern')) null, "template_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "attribute_definition_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_attribute_definition_template_id" ON "attribute_definition" ("template_id") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_attribute_definition_deleted_at" ON "attribute_definition" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_attribute_definition_template_id_key_unique" ON "attribute_definition" ("template_id", "key") WHERE deleted_at IS NULL;`
    )

    this.addSql(
      `create table if not exists "attribute_value" ("id" text not null, "value_text" text null, "value_number" numeric null, "value_boolean" boolean null, "value_options" jsonb null, "definition_id" text not null, "raw_value_number" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "attribute_value_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_attribute_value_definition_id" ON "attribute_value" ("definition_id") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_attribute_value_deleted_at" ON "attribute_value" ("deleted_at") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_attribute_value_definition_id_value_number" ON "attribute_value" ("definition_id", "value_number") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_attribute_value_definition_id_value_text" ON "attribute_value" ("definition_id", "value_text") WHERE deleted_at IS NULL;`
    )

    // Facet filters on multiple choice (adr/0013, F3.17); the DML cannot declare a GIN index
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_attribute_value_value_options_gin" ON "attribute_value" USING gin ("value_options") WHERE deleted_at IS NULL;`
    )
    this.addSql(
      `alter table if exists "attribute_definition" add constraint "attribute_definition_template_id_foreign" foreign key ("template_id") references "attribute_template" ("id") on update cascade;`
    )

    this.addSql(
      `alter table if exists "attribute_value" add constraint "attribute_value_definition_id_foreign" foreign key ("definition_id") references "attribute_definition" ("id") on update cascade;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "attribute_definition" drop constraint if exists "attribute_definition_template_id_foreign";`
    )

    this.addSql(
      `alter table if exists "attribute_value" drop constraint if exists "attribute_value_definition_id_foreign";`
    )

    this.addSql(`drop table if exists "attribute_template" cascade;`)

    this.addSql(`drop table if exists "attribute_definition" cascade;`)

    this.addSql(`drop table if exists "attribute_value" cascade;`)
  }
}
