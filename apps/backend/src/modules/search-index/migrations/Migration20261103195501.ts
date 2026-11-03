import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/**
 * adr/0056: the search index in PostgreSQL full text. `unaccent` and
 * `pg_trgm` are trusted extensions (PostgreSQL 13+): the database's owner
 * creates them without a superuser. The index tables are written and read
 * by this module's own SQL only (no ORM entity): a product's weighted
 * `tsvector` holds its words as compared (`simple`) and its Turkish stems
 * without marks, the stems marked with `~` so a word's prefix never meets
 * them.
 */
export class Migration20261103195501 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`CREATE EXTENSION IF NOT EXISTS unaccent;`)
    this.addSql(`CREATE EXTENSION IF NOT EXISTS pg_trgm;`)

    // A text's Turkish stems, each without its marks and marked `~`, at the words' positions
    this.addSql(`CREATE OR REPLACE FUNCTION search_index_stems(input text) RETURNS tsvector
      LANGUAGE sql STABLE PARALLEL SAFE AS $$
        SELECT coalesce(string_agg(
                 '''' || replace(replace('~' || unaccent(s.lexeme), '\\', '\\\\'), '''', '''''')
                   || ''':' || array_to_string(s.positions, ','),
                 ' '), '')::tsvector
          FROM unnest(to_tsvector('turkish', coalesce(input, ''))) AS s
      $$;`)

    // A row's searchable text: each weight's words as compared, and their stems
    this.addSql(`CREATE OR REPLACE FUNCTION search_index_document(fields jsonb) RETURNS tsvector
      LANGUAGE sql STABLE PARALLEL SAFE AS $$
        SELECT setweight(to_tsvector('simple', coalesce(fields->'a'->>'f', '')), 'A')
            || setweight(search_index_stems(fields->'a'->>'m'), 'A')
            || setweight(to_tsvector('simple', coalesce(fields->'b'->>'f', '')), 'B')
            || setweight(search_index_stems(fields->'b'->>'m'), 'B')
            || setweight(to_tsvector('simple', coalesce(fields->'c'->>'f', '')), 'C')
            || setweight(search_index_stems(fields->'c'->>'m'), 'C')
            || setweight(to_tsvector('simple', coalesce(fields->'d'->>'f', '')), 'D')
            || setweight(search_index_stems(fields->'d'->>'m'), 'D')
      $$;`)

    this.addSql(`CREATE TABLE IF NOT EXISTS "search_document" (
      "product_id" text NOT NULL,
      "published" boolean NOT NULL DEFAULT false,
      "title" text NOT NULL DEFAULT '',
      "fields" jsonb NOT NULL,
      "vocabulary" jsonb NOT NULL DEFAULT '[]'::jsonb,
      "sales_channel_ids" text[] NOT NULL DEFAULT '{}',
      "category_ids" text[] NOT NULL DEFAULT '{}',
      "categories" jsonb NOT NULL DEFAULT '[]'::jsonb,
      "collection_id" text NULL,
      "brand_id" text NULL,
      "brand_handle" text NULL,
      "brand_name" text NULL,
      "options" text[] NOT NULL DEFAULT '{}',
      "prices" jsonb NOT NULL DEFAULT '{}'::jsonb,
      "in_stock" boolean NOT NULL DEFAULT true,
      "popularity" integer NOT NULL DEFAULT 0,
      "product_created_at" timestamptz NOT NULL,
      "document" tsvector NOT NULL,
      "indexed_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "search_document_pkey" PRIMARY KEY ("product_id"));`)
    // Kept in the row, compressed: every search reads it several times per product, and a
    // vector moved out of line (the wide JSON columns push it) is fetched again each time
    this.addSql(`ALTER TABLE "search_document" ALTER COLUMN "document" SET STORAGE MAIN;`)
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_search_document_document" ON "search_document" USING gin ("document");`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_search_document_category_ids" ON "search_document" USING gin ("category_ids");`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_search_document_options" ON "search_document" USING gin ("options");`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_search_document_brand_id" ON "search_document" ("brand_id") WHERE "brand_id" IS NOT NULL;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_search_document_collection_id" ON "search_document" ("collection_id") WHERE "collection_id" IS NOT NULL;`
    )

    // Every published row's words once: typo neighbours (trigrams), roots, the catalogue's spelling
    this.addSql(`CREATE TABLE IF NOT EXISTS "search_word" (
      "word" text NOT NULL,
      "display" text NOT NULL,
      "title_docs" integer NOT NULL DEFAULT 0,
      "docs" integer NOT NULL DEFAULT 0,
      CONSTRAINT "search_word_pkey" PRIMARY KEY ("word"));`)
    this.addSql(
      // Words with a digit (codes, sizes) are never a typo's neighbour: left out of the trigram index
      `CREATE INDEX IF NOT EXISTS "IDX_search_word_trigrams" ON "search_word" USING gin ("word" gin_trgm_ops) WHERE "word" !~ '[0-9]';`
    )

    // Products to index again: a write adds them, a drain claims and clears them
    this.addSql(`CREATE TABLE IF NOT EXISTS "search_pending" (
      "product_id" text NOT NULL,
      "version" bigint NOT NULL DEFAULT 1,
      "queued_at" timestamptz NOT NULL DEFAULT now(),
      "claimed_at" timestamptz NULL,
      CONSTRAINT "search_pending_pkey" PRIMARY KEY ("product_id"));`)
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_search_pending_queued_at" ON "search_pending" ("queued_at");`
    )

    this.addSql(
      `create table if not exists "search_synonym" ("id" text not null, "terms" text[] not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "search_synonym_pkey" primary key ("id"));`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_search_synonym_deleted_at" ON "search_synonym" ("deleted_at") WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "search_synonym" cascade;`)
    this.addSql(`drop table if exists "search_pending" cascade;`)
    this.addSql(`drop table if exists "search_word" cascade;`)
    this.addSql(`drop table if exists "search_document" cascade;`)
    this.addSql(`drop function if exists search_index_document(jsonb);`)
    this.addSql(`drop function if exists search_index_stems(text);`)
  }
}
