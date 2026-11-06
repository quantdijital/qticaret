import { ValidationError } from "../../lib/errors"
import { isCleanText } from "../../lib/security"

/**
 * What a blog author may hold (adr/0060), the pure part: a clean name and
 * job title, a plain bio of paragraphs, and their own pages on the web.
 * The plan (`author-plan.ts`) adds the handle, the photo and the staff
 * account, which need the database.
 */

export const AUTHOR_LIMITS = { name: 120, jobTitle: 120, bio: 2000, link: 2048 } as const

export const AUTHOR_LINKS = ["website_url", "linkedin_url", "instagram_url", "x_url"] as const
export type AuthorLinkField = (typeof AUTHOR_LINKS)[number]

/** The hosts a profile link must be on; the website may be anywhere. */
const PROFILE_HOSTS: Readonly<Record<Exclude<AuthorLinkField, "website_url">, string[]>> = {
  linkedin_url: ["linkedin.com"],
  instagram_url: ["instagram.com"],
  x_url: ["x.com", "twitter.com"],
}

const onHost = (host: string, wanted: readonly string[]) =>
  wanted.some((own) => host === own || host.endsWith(`.${own}`))

/**
 * A link as stored: an https address with a host and no credentials, on
 * the network's own site for a profile; empty is none.
 */
export function linkOf(raw: string | null, field: AuthorLinkField): string | null {
  const text = raw?.trim() ?? ""
  if (text === "") {
    return null
  }
  const refuse = () => new ValidationError("content.author_link_invalid", { field })
  if (text.length > AUTHOR_LIMITS.link || !isCleanText(text) || /\s/.test(text)) {
    throw refuse()
  }
  let url: URL
  try {
    url = new URL(text)
  } catch {
    throw refuse()
  }
  const host = url.hostname.toLowerCase()
  if (url.protocol !== "https:" || !host.includes(".") || url.username || url.password) {
    throw refuse()
  }
  if (field !== "website_url" && !onHost(host, PROFILE_HOSTS[field])) {
    throw refuse()
  }
  return url.href
}

/**
 * A bio as stored: plain text, its lines trimmed, at most one blank line
 * between paragraphs; empty is none.
 */
export function bioOf(raw: string | null): string | null {
  const text = (raw ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim().replace(/\s+/g, " "))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
  if (text === "") {
    return null
  }
  if (text.length > AUTHOR_LIMITS.bio || !text.split("\n").every((line) => isCleanText(line))) {
    throw new ValidationError("content.author_bio_invalid", { field: "bio" })
  }
  return text
}

/** The bio's paragraphs, as the storefront and the structured data read them. */
export const bioParagraphs = (bio: string | null): string[] =>
  (bio ?? "")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\n/g, " ").trim())
    .filter(Boolean)

// One clean line, its spaces collapsed; past `max` or unclean, refused on its field
function lineIn(raw: string, max: number, key: string, field: string): string {
  const text = raw.trim().replace(/\s+/g, " ")
  if (text.length > max || !isCleanText(text)) {
    throw new ValidationError(key, { field })
  }
  return text
}

export function authorNameOf(raw: string): string {
  const name = lineIn(raw, AUTHOR_LIMITS.name, "content.author_name_invalid", "name")
  if (name === "") {
    throw new ValidationError("content.author_name_invalid", { field: "name" })
  }
  return name
}

export function jobTitleOf(raw: string | null): string | null {
  const text = raw?.trim() ?? ""
  return text === ""
    ? null
    : lineIn(text, AUTHOR_LIMITS.jobTitle, "content.author_job_title_invalid", "job_title")
}

/** The author's own pages in a fixed order: the structured data's `sameAs`. */
export const authorLinks = (author: Readonly<Record<AuthorLinkField, string | null>>) =>
  AUTHOR_LINKS.flatMap((field) => {
    const url = author[field]
    return url ? [{ kind: field.replace(/_url$/, "") as LinkKind, url }] : []
  })

export type LinkKind = "website" | "linkedin" | "instagram" | "x"
