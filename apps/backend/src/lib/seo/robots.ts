import { facetDisallowLines } from "./facets"

/**
 * robots.txt (docs/13 §6, §7, §9): the shop's own template with the
 * sitemap's address and the listing filters' lines filled in, and the AI
 * crawler preset after it. A shop that must
 * stay out of search (staging, a preview instance) gets a file that keeps
 * every crawler out, whatever its template says.
 */

export type AiCrawlerPreset = "ai_search_visible" | "block_training" | "none"

// Crawlers that collect text to train models; search crawlers (OAI-SearchBot,
// PerplexityBot, Claude-SearchBot) stay allowed. User-triggered fetchers
// (ChatGPT-User) do not read robots.txt at all (docs/13 §9)
export const TRAINING_CRAWLERS = [
  "GPTBot",
  "ClaudeBot",
  "CCBot",
  "Google-Extended",
  "Applebot-Extended",
  "Bytespider",
  "Meta-ExternalAgent",
] as const

const SITEMAP_TOKEN = "{sitemap_url}"
export const FACET_TOKEN = "{facet_disallow}"

export interface RobotsInput {
  template: string
  /** Absolute; null drops the lines that name it (no host yet). */
  sitemapUrl: string | null
  preset: AiCrawlerPreset
  indexing: boolean
  /** The attribute keys listings filter by: each gets its lines where the template has the token. */
  filterKeys: Iterable<string>
}

export function robotsTxt({
  template,
  sitemapUrl,
  preset,
  indexing,
  filterKeys,
}: RobotsInput): string {
  if (!indexing) {
    return "User-agent: *\nDisallow: /\n"
  }
  const facets = facetDisallowLines(filterKeys)
  const lines = template
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .flatMap((line) => {
      if (line.trim() === FACET_TOKEN) {
        return facets
      }
      if (line.includes(SITEMAP_TOKEN)) {
        return sitemapUrl ? [line.split(SITEMAP_TOKEN).join(sitemapUrl)] : []
      }
      return [line]
    })
  if (preset === "block_training") {
    lines.push("", ...TRAINING_CRAWLERS.map((agent) => `User-agent: ${agent}`), "Disallow: /")
  }
  return `${lines.join("\n").trim()}\n`
}
