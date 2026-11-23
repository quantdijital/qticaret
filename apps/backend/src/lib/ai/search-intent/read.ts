import { z } from "@medusajs/framework/zod"
import { MAX_QUERY_LENGTH, MAX_QUERY_WORDS, wordsOf } from "../../search"
import { MAX_PAX, monthsOf, rangeOf } from "../../seo/facets-dated"
import { MAX_FILTER_KEYS, MAX_FILTER_VALUES, MAX_FILTER_VALUES_TOTAL } from "../../seo/facets"
import { jsonObjectOf } from "../product-card"
import type { DroppedPart, SearchField, SearchFilter, SearchLists } from "./types"

/**
 * The service's answer read as data, never trusted (adr/0077 §7, adr/0071
 * §9): one JSON object of a closed schema (an unknown field refuses the
 * whole answer), then each part on its own against the shop's lists and
 * the dated rules (`facets-dated.ts`). A part that does not pass is left
 * out and named in `dropped` (its kind and why, never its text). `q`
 * keeps only words the shopper wrote: the model cannot add a word.
 */

const answerSchema = z
  .object({
    q: z.string().max(500).nullish(),
    kategori: z.string().max(200).nullish(),
    tarih: z
      .object({ from: z.string().max(20), to: z.string().max(20) })
      .strict()
      .nullish(),
    ay: z.array(z.string().max(20)).max(12).nullish(),
    kisi: z.union([z.number(), z.string().max(4)]).nullish(),
    nitelikler: z
      .record(z.string().max(64), z.array(z.string().max(100)).max(40))
      .refine((record) => Object.keys(record).length <= 40)
      .nullish(),
  })
  .strict()

type Answer = z.infer<typeof answerSchema>

// A field the answer wrote: neither left out nor null
const given = <T>(value: T | null | undefined): value is T => value !== null && value !== undefined

export type SearchRead = { filter: SearchFilter; dropped: DroppedPart[] } | null

/** The answer's words that are words of the sentence sent, as typed there; null when none is. */
function ownWords(raw: string, sent: string): string | null {
  const said = new Map(wordsOf(sent).map((word) => [word.norm, word.display]))
  const kept: string[] = []
  for (const word of wordsOf(raw)) {
    const own = said.get(word.norm)
    if (own !== undefined && !kept.includes(own) && kept.length < MAX_QUERY_WORDS) {
      kept.push(own)
    }
  }
  const q = kept.join(" ").slice(0, MAX_QUERY_LENGTH).trim()
  return q === "" ? null : q
}

/** The party asked: an integer 1..MAX_PAX, a numeral too. */
function paxOf(raw: number | string): number | null {
  const value = typeof raw === "number" ? raw : /^\d{1,2}$/.test(raw.trim()) ? Number(raw) : NaN
  return Number.isInteger(value) && value >= 1 && value <= MAX_PAX ? value : null
}

/** The attributes named, against the shop's list and the listing's bounds. */
function attributesOf(
  raw: Record<string, string[]>,
  lists: SearchLists,
  drop: (kind: SearchField, reason: DroppedPart["reason"]) => void
): [string, string[]][] {
  const known = new Map(lists.attributes.map((each) => [each.key, each]))
  const picked: [string, string[]][] = []
  let total = 0
  for (const key of Object.keys(raw).sort()) {
    const attribute = Object.hasOwn(raw, key) ? known.get(key) : undefined
    if (attribute === undefined) {
      drop("nitelik", "unknown")
      continue
    }
    const offered = new Set(attribute.values.map((each) => each.value))
    const values = [...new Set(raw[key] ?? [])].filter((value) => {
      const ok = offered.has(value)
      if (!ok) {
        drop("nitelik", "unknown")
      }
      return ok
    })
    const room = Math.min(MAX_FILTER_VALUES, MAX_FILTER_VALUES_TOTAL - total)
    if (values.length > room || picked.length >= MAX_FILTER_KEYS) {
      drop("nitelik", "invalid")
    }
    const kept = picked.length < MAX_FILTER_KEYS ? values.slice(0, Math.max(0, room)) : []
    if (kept.length > 0) {
      picked.push([key, kept.sort()])
      total += kept.length
    }
  }
  return picked
}

/** The dated parts: a range wins over months; nothing while the shop sells no dated product. */
function datedOf(
  answer: Answer,
  lists: SearchLists,
  filter: SearchFilter,
  drop: (kind: SearchField, reason: DroppedPart["reason"]) => void
): void {
  const asked = {
    tarih: given(answer.tarih),
    ay: given(answer.ay) && answer.ay.length > 0,
    kisi: given(answer.kisi),
  }
  if (!lists.booking) {
    for (const kind of ["tarih", "ay", "kisi"] as const) {
      if (asked[kind]) {
        drop(kind, "not_offered")
      }
    }
    return
  }
  const range = answer.tarih
    ? rangeOf(`${answer.tarih.from}_${answer.tarih.to}`, lists.today)
    : null
  if (asked.tarih && range === null) {
    drop("tarih", "invalid")
  }
  if (range !== null) {
    filter.dates = range
    if (asked.ay) {
      drop("ay", "not_offered")
    }
  } else if (asked.ay && answer.ay) {
    const months = monthsOf(answer.ay.join(","), lists.today)
    const kept = months?.kind === "months" ? months.months.length : 0
    if (kept < new Set(answer.ay.map((each) => each.trim())).size) {
      drop("ay", "invalid")
    }
    if (months !== null) {
      filter.dates = months
    }
  }
  if (given(answer.kisi)) {
    const pax = paxOf(answer.kisi)
    if (pax === null) {
      drop("kisi", "invalid")
    } else if (pax > 1) {
      filter.pax = pax
    }
  }
}

/**
 * The filter the server accepts of an answer, and the parts it left out;
 * null when the answer is no object of the schema (the search falls back
 * to the sentence). `sent` is the sentence as the service saw it.
 */
export function readSearchAnswer(raw: string, lists: SearchLists, sent: string): SearchRead {
  const parsed = answerSchema.safeParse(jsonObjectOf(raw))
  if (!parsed.success) {
    return null
  }
  const answer = parsed.data
  const filter: SearchFilter = {}
  const dropped: DroppedPart[] = []
  const drop = (kind: SearchField, reason: DroppedPart["reason"]) => {
    if (!dropped.some((each) => each.kind === kind && each.reason === reason)) {
      dropped.push({ kind, reason })
    }
  }
  if (given(answer.q) && answer.q.trim() !== "") {
    const q = ownWords(answer.q, sent)
    if (q === null) {
      drop("q", "unknown")
    } else {
      filter.q = q
    }
  }
  if (given(answer.kategori) && answer.kategori.trim() !== "") {
    const category = lists.categories.find((each) => each.handle === answer.kategori)
    if (category === undefined) {
      drop("kategori", "unknown")
    } else {
      filter.category = category.handle
    }
  }
  if (given(answer.nitelikler)) {
    const attributes = attributesOf(answer.nitelikler, lists, drop)
    if (attributes.length > 0) {
      filter.attributes = attributes
    }
  }
  datedOf(answer, lists, filter, drop)
  return { filter, dropped }
}
