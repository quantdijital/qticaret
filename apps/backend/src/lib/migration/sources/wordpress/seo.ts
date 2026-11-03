import { SEO_META_LIMITS } from "../../../seo/meta"
import { decodeEntities } from "../../text"
import { textOf, unserialize } from "./php"

/**
 * A page's own SEO fields as Rank Math or Yoast kept them in its meta. A
 * title written with the plugin's variables (`%title% %sep% %sitename%`)
 * is filled in where the variable is known; one that is only variables,
 * or names one not known here, is left out so the shop's own title
 * template takes it (adr/0015). The focus keyword is the first of the
 * plugin's list.
 */

export interface SeoFields {
  seo_title: string | null
  seo_description: string | null
  focus_keyword: string | null
  robots: "noindex_follow" | "noindex_nofollow" | null
}

export interface SeoValues {
  /** The record's own name: `%title%`, `%term%`. */
  title: string
  /** The old site's name: `%sitename%`. */
  site: string
}

const KEYS = {
  title: ["rank_math_title", "_yoast_wpseo_title"],
  description: ["rank_math_description", "_yoast_wpseo_metadesc"],
  keyword: ["rank_math_focus_keyword", "_yoast_wpseo_focuskw"],
} as const

// Rank Math's `%var%`, Yoast's `%%var%%`
const VARIABLE = /%%?([a-z_]+)(\([^%()]*\))?%%?/gi
// The plugins' default separator: a title's "%sep%"
const SEPARATOR = "-"

const firstOf = (meta: ReadonlyMap<string, string>, keys: readonly string[]) =>
  keys.map((key) => decodeEntities(meta.get(key) ?? "").trim()).find((value) => value !== "") ??
  null

/** Text cut at a word within `max`. */
export function cutAt(text: string, max: number): string {
  if (text.length <= max) {
    return text
  }
  const cut = text.slice(0, max)
  const space = cut.lastIndexOf(" ")
  return (space > max / 2 ? cut.slice(0, space) : cut).trim()
}

/** The text with the variables filled in; null when it is only variables or names one not known. */
export function filled(raw: string | null, values: SeoValues): string | null {
  if (!raw) {
    return null
  }
  if (raw.replace(VARIABLE, "").replace(/[\s|\-–—:·•]+/g, "") === "") {
    return null
  }
  const unknown: string[] = []
  const known: Readonly<Record<string, string>> = {
    title: values.title,
    term: values.title,
    name: values.title,
    sitename: values.site,
    sep: SEPARATOR,
    page: "",
    currentyear: String(new Date().getFullYear()),
  }
  const text = raw.replace(VARIABLE, (_, name: string, args: string | undefined) => {
    // One with arguments (`%customfield(x)%`) reads data the export does not hold
    const value = args ? undefined : known[name.toLowerCase()]
    if (value === undefined) {
      unknown.push(name)
    }
    return value ?? ""
  })
  const tidy = text
    .replace(/\s+/g, " ")
    .replace(/^[\s|\-–—:]+|[\s|\-–—:]+$/g, "")
    .trim()
  return unknown.length > 0 || tidy === "" ? null : tidy
}

/** Whether the old site kept the page out of search results, and its links too. */
function robotsOf(meta: ReadonlyMap<string, string>): SeoFields["robots"] {
  const rankMath = unserialize(meta.get("rank_math_robots") ?? "")
  const values = rankMath instanceof Map ? [...rankMath.values()].map((value) => textOf(value)) : []
  const noindex = values.includes("noindex") || meta.get("_yoast_wpseo_meta-robots-noindex") === "1"
  const nofollow =
    values.includes("nofollow") || meta.get("_yoast_wpseo_meta-robots-nofollow") === "1"
  return noindex ? (nofollow ? "noindex_nofollow" : "noindex_follow") : null
}

/** The page's own SEO fields from its (or its term's) meta. */
export function seoFieldsOf(meta: ReadonlyMap<string, string>, values: SeoValues): SeoFields {
  const title = filled(firstOf(meta, KEYS.title), values)
  const description = filled(firstOf(meta, KEYS.description), values)
  const keyword = firstOf(meta, KEYS.keyword)?.split(",")[0]?.trim() ?? ""
  return {
    seo_title: title ? cutAt(title, SEO_META_LIMITS.seo_title) : null,
    seo_description: description ? cutAt(description, SEO_META_LIMITS.seo_description) : null,
    focus_keyword: keyword ? cutAt(keyword, SEO_META_LIMITS.focus_keyword) : null,
    robots: robotsOf(meta),
  }
}
