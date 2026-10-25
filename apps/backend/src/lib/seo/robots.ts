/**
 * robots.txt (docs/13 §6, §9): the shop's own template with the sitemap's
 * address filled in, and the AI crawler preset after it. A shop that must
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

export interface RobotsInput {
  template: string
  /** Absolute; null drops the lines that name it (no host yet). */
  sitemapUrl: string | null
  preset: AiCrawlerPreset
  indexing: boolean
}

export function robotsTxt({ template, sitemapUrl, preset, indexing }: RobotsInput): string {
  if (!indexing) {
    return "User-agent: *\nDisallow: /\n"
  }
  const lines = template
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .flatMap((line) =>
      line.includes(SITEMAP_TOKEN)
        ? sitemapUrl
          ? [line.split(SITEMAP_TOKEN).join(sitemapUrl)]
          : []
        : [line]
    )
  if (preset === "block_training") {
    lines.push("", ...TRAINING_CRAWLERS.map((agent) => `User-agent: ${agent}`), "Disallow: /")
  }
  return `${lines.join("\n").trim()}\n`
}
