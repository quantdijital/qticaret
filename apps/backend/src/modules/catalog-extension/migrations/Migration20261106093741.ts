import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/**
 * adr/0055 Ek 2026-11-06: the short description as the shop wrote it, a
 * content document (`summary_doc`), in place of yesterday's plain lines
 * (`summary`, only ever in development). Lines already there become one
 * bullet list, an item each, so nothing written is lost: `summary:backfill`
 * then writes the excerpt as written over the lists the 2026-11-05 build
 * made, and leaves the shop's own.
 */
export class Migration20261106093741 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "product_extension" add column if not exists "summary_doc" jsonb null;`
    )
    this.addSql(`update "product_extension" set "summary_doc" = jsonb_build_object(
      'type', 'doc',
      'content', jsonb_build_array(jsonb_build_object(
        'type', 'bulletList',
        'content', (
          select jsonb_agg(jsonb_build_object(
            'type', 'listItem',
            'content', jsonb_build_array(jsonb_build_object(
              'type', 'paragraph',
              'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', lines.line))
            ))
          ) order by lines.position)
          from unnest("summary") with ordinality as lines(line, position)
          where btrim(lines.line) <> ''
        )
      ))
    )
    where "summary_doc" is null
      and exists (select 1 from unnest("summary") as lines(line) where btrim(lines.line) <> '');`)
    this.addSql(`alter table if exists "product_extension" drop column if exists "summary";`)
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "product_extension" add column if not exists "summary" text[] null;`
    )
    // A document that is one bullet list goes back as its items' first texts; any other is lost
    this.addSql(`update "product_extension" set "summary" = (
      select array_agg(items.item #>> '{content,0,content,0,text}' order by items.position)
      from jsonb_array_elements("summary_doc" #> '{content,0,content}') with ordinality as items(item, position)
    )
    where jsonb_typeof("summary_doc" -> 'content') = 'array'
      and jsonb_array_length("summary_doc" -> 'content') = 1
      and "summary_doc" #>> '{content,0,type}' = 'bulletList';`)
    this.addSql(`alter table if exists "product_extension" drop column if exists "summary_doc";`)
  }
}
