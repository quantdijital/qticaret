import type { AnalysedWord, Executor } from "../types"
import { TEXT_ARRAY } from "./documents"
import { Statement } from "./statement"

/**
 * What the index knows of a query's words (adr/0056), in one statement:
 * each word's Turkish stem without marks (PostgreSQL's `turkish_stem`
 * dictionary, then `unaccent`), how the catalogue writes it, the
 * catalogue words it starts with (primary key lookups), and its trigram
 * neighbours in the word dictionary (`pg_trgm`). Each word's neighbours
 * are asked with the word bound as a value, so the planner reads the
 * trigram index (GIN) instead of comparing every word; the operator's
 * threshold is set for this transaction only.
 */

/** Neighbours read per word: enough for the typo ways and three suggestions. */
const ALIKE_READ = 12

/** The lowest threshold any word uses (5+ letters); shorter words filter higher. */
const TRIGRAM_THRESHOLD = "0.25"

export interface WordToAnalyse {
  norm: string
  /** As typed: the stemmer reads Turkish with its marks. */
  display: string
  /** Its starts that may be catalogue words (`rootCandidates`). */
  roots: string[]
  /** The least similarity a typo of it needs; null when it takes none. */
  least: number | null
}

interface Row {
  norm: string
  stem: string | null
  display: string | null
  roots: string[] | null
  alike: [string, string, number, number][] | null
}

// One word's neighbours: the partial trigram index holds words without a digit
const neighbours = (sql: Statement, word: WordToAnalyse) =>
  `(SELECT ${sql.param(word.norm)}::text AS norm, w.word, w.display, w.title_docs,
           similarity(w.word, ${sql.param(word.norm)}) AS sim
      FROM search_word w
     WHERE w.word % ${sql.param(word.norm)} AND w.word !~ '[0-9]'
     ORDER BY sim DESC, w.title_docs DESC, w.word
     LIMIT ${String(ALIKE_READ)})`

export async function analyseWords(
  db: Executor,
  words: readonly WordToAnalyse[]
): Promise<AnalysedWord[]> {
  if (words.length === 0) {
    return []
  }
  const sql = new Statement()
  const input = sql.param(JSON.stringify(words))
  const typed = words.filter((word) => word.least !== null)
  const alike =
    typed.length > 0
      ? typed.map((word) => neighbours(sql, word)).join(" UNION ALL ")
      : "SELECT NULL::text AS norm, NULL::text AS word, NULL::text AS display, 0 AS title_docs, 0::real AS sim WHERE false"
  const { sql: text, params } = sql.finish(`
    WITH i AS (
      SELECT * FROM jsonb_to_recordset(${input}::jsonb)
        AS i(norm text, display text, roots jsonb, least float8)
    ), alike AS (${alike})
    SELECT i.norm,
           (SELECT unaccent(lexeme) FROM unnest(ts_lexize('turkish_stem', i.display)) AS lexeme
             LIMIT 1) AS stem,
           (SELECT w.display FROM search_word w WHERE w.word = i.norm) AS display,
           ARRAY(SELECT w.word FROM search_word w
                  WHERE w.word = ANY(ARRAY(SELECT jsonb_array_elements_text(i.roots)))
                  ORDER BY length(w.word) DESC) AS roots,
           (SELECT jsonb_agg(jsonb_build_array(a.word, a.display, a.sim, a.title_docs)
                             ORDER BY a.sim DESC, a.title_docs DESC, a.word)
              FROM alike a WHERE a.norm = i.norm AND a.sim >= i.least) AS alike
      FROM i`)
  await db.execute(`SET LOCAL pg_trgm.similarity_threshold = ${TRIGRAM_THRESHOLD}`, [])
  const rows = (await db.execute(text, params)) as Row[]
  return rows.map((row) => ({
    norm: row.norm,
    stem: row.stem === "" ? null : row.stem,
    display: row.display,
    roots: row.roots ?? [],
    alike: (row.alike ?? []).map(([word, display, similarity, titles]) => ({
      word,
      display,
      similarity,
      titles,
    })),
  }))
}

/**
 * Which of these queries some published product in the channels matches:
 * whether a word is the catalogue's own, whether a suggestion finds anything.
 */
export async function matchesAny(
  db: Executor,
  queries: readonly string[],
  channels: readonly string[] | null
): Promise<boolean[]> {
  if (queries.length === 0) {
    return []
  }
  const params: unknown[] = []
  let inChannels = ""
  if (channels) {
    inChannels = `AND d.sales_channel_ids && ${TEXT_ARRAY}`
    params.push(JSON.stringify(channels))
  }
  params.push(JSON.stringify(queries.map((query, ord) => ({ ord, query }))))
  const rows = (await db.execute(
    `SELECT c.ord, EXISTS (
              SELECT 1 FROM search_document d
               WHERE d.published ${inChannels} AND d.document @@ c.query::tsquery) AS found
       FROM jsonb_to_recordset(?::jsonb) AS c(ord integer, query text)
      ORDER BY c.ord`,
    params
  )) as { ord: number; found: boolean }[]
  return rows.map((row) => row.found)
}
