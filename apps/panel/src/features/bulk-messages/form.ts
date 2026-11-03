import type { JSONContent } from "@tiptap/react"
import { z } from "zod"
import { docText } from "@/features/content/doc-text"
import { unknownShopTokens } from "@/features/settings/shop-tokens"
import type { AudienceSource, BulkMessage, BulkMessageInput } from "./api/types"
import { SMS_MAX_PARTS } from "./sms"

/**
 * The bulk message editor's values and the body it sends: the backend's
 * `AdminUpdateCampaign` limits (name 100, subject 120, preview line 150,
 * text 800, 1 to 10 audience sources), its tokens (`{ad}` and the shop's
 * details) and at most four product cards. The server checks all again.
 */

const B = "bulkMessages.errors"

export const LIMITS = {
  name: 100,
  subject: 120,
  preheader: 150,
  sms: 800,
  sources: 10,
  productCards: 4,
} as const

/** The recipient's first name; any other `{name}` must be a shop detail. */
export const NAME_TOKEN = "ad"

export const EMPTY_DOC: JSONContent = { type: "doc", content: [{ type: "paragraph" }] }

/** The `{name}`s the server would refuse in a line. */
export const unknownTokens = (text: string): string[] =>
  unknownShopTokens(text).filter((name) => name !== NAME_TOKEN)

function walk(node: JSONContent, visit: (node: JSONContent) => void) {
  visit(node)
  node.content?.forEach((child) => {
    walk(child, visit)
  })
}

/** Each text node's words, a block's own run of text kept together. */
function docLines(doc: JSONContent): string[] {
  const lines: string[] = []
  walk(doc, (node) => {
    if (node.content?.some((child) => child.type === "text")) {
      lines.push(node.content.map((child) => child.text ?? "").join(""))
    }
  })
  return lines
}

export const unknownDocTokens = (doc: JSONContent): string[] => [
  ...new Set(docLines(doc).flatMap(unknownTokens)),
]

/** The different products the e-mail shows as cards. */
export function productCardCount(doc: JSONContent): number {
  const ids = new Set<string>()
  walk(doc, (node) => {
    const id: unknown = node.attrs?.["id"]
    if (node.type === "productCard" && typeof id === "string") {
      ids.add(id)
    }
  })
  return ids.size
}

const MEDIA = new Set(["image", "productCard", "categoryCard"])

const hasMedia = (node: JSONContent): boolean =>
  MEDIA.has(node.type ?? "") || (node.content ?? []).some(hasMedia)

/** No words, no picture, no card: what the editor holds before anything is written. */
export const isEmptyDoc = (doc: JSONContent | null | undefined): boolean =>
  !doc || (!hasMedia(doc) && docText(doc) === "")

const sourceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("segment"), id: z.string().min(1) }),
  z.object({ kind: z.literal("group"), id: z.string().min(1) }),
  z.object({ kind: z.literal("all_consented") }),
  z.object({ kind: z.literal("newsletter") }),
])

const line = (max: number) =>
  z
    .string()
    .max(max, `${B}.tooLong`)
    .refine((text) => unknownTokens(text).length === 0, `${B}.tokenUnknown`)

/**
 * `smsParts` counts a text as it would go (its footer added); none while
 * the shop's details load, and the server counts it on save anyway.
 */
export function editorSchema(smsParts?: (text: string) => number | null) {
  return z.object({
    name: z.string().trim().min(1, `${B}.nameRequired`).max(LIMITS.name, `${B}.tooLong`),
    channel: z.enum(["email", "sms"]),
    audience: z
      .array(sourceSchema)
      .min(1, `${B}.audienceRequired`)
      .max(LIMITS.sources, `${B}.audienceTooMany`),
    subject: line(LIMITS.subject),
    preheader: line(LIMITS.preheader),
    body: z
      .custom<JSONContent>((value) => typeof value === "object" && value !== null)
      .refine((doc) => unknownDocTokens(doc).length === 0, `${B}.tokenUnknown`)
      .refine((doc) => productCardCount(doc) <= LIMITS.productCards, `${B}.tooManyProducts`),
    sms_text: line(LIMITS.sms).refine((text) => {
      const parts = text.trim() === "" ? null : (smsParts?.(text) ?? null)
      return parts === null || parts <= SMS_MAX_PARTS
    }, `${B}.smsTooLong`),
  })
}

export type EditorValues = z.infer<ReturnType<typeof editorSchema>>

export const valuesOf = (campaign: BulkMessage): EditorValues => ({
  name: campaign.name,
  channel: campaign.channel,
  audience: campaign.audience,
  subject: campaign.subject ?? "",
  preheader: campaign.preheader ?? "",
  body: campaign.body ?? EMPTY_DOC,
  sms_text: campaign.sms_text ?? "",
})

const orNull = (text: string): string | null => (text.trim() === "" ? null : text.trim())

/** The body `POST /admin/bulk-messages/:id` takes: every field, an empty one as null. */
export const requestOf = (values: EditorValues): BulkMessageInput => ({
  name: values.name.trim(),
  channel: values.channel,
  audience: values.audience,
  subject: orNull(values.subject),
  preheader: orNull(values.preheader),
  body: isEmptyDoc(values.body) ? null : values.body,
  sms_text: orNull(values.sms_text),
})

/** What the channel needs before a test or a send (the backend's `assertComplete`). */
export const missingContent = (
  values: Pick<EditorValues, "channel" | "subject" | "body" | "sms_text">
): ("subject" | "body" | "sms_text")[] =>
  values.channel === "sms"
    ? values.sms_text.trim() === ""
      ? ["sms_text"]
      : []
    : [
        ...(values.subject.trim() === "" ? (["subject"] as const) : []),
        ...(isEmptyDoc(values.body) ? (["body"] as const) : []),
      ]

/** One source picked or dropped; two sources of the same kind and id never sit together. */
export function toggleSource(
  sources: readonly AudienceSource[],
  source: AudienceSource,
  on: boolean
): AudienceSource[] {
  const same = (other: AudienceSource) =>
    other.kind === source.kind &&
    ("id" in other ? other.id : null) === ("id" in source ? source.id : null)
  const rest = sources.filter((other) => !same(other))
  return on ? [...rest, source] : rest
}

export const hasSource = (sources: readonly AudienceSource[], source: AudienceSource): boolean =>
  toggleSource(sources, source, false).length !== sources.length
