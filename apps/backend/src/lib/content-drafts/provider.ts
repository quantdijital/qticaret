import { parseEnv } from "../env"

/** Drafts a month when the platform sets no quota of its own. */
const DEFAULT_MONTHLY_QUOTA = 200

/** How many drafts a shop may ask for in a month (`CONTENT_DRAFT_MONTHLY_QUOTA`). */
export const draftMonthlyQuota = (): number =>
  parseEnv().CONTENT_DRAFT_MONTHLY_QUOTA ?? DEFAULT_MONTHLY_QUOTA
import type { DraftKind, ProductDraftFacts } from "./prompts"

/**
 * A content draft provider (adr/0005): a cloud API or a self-hosted model
 * behind one interface. Which one, and its data processing agreement, is
 * the platform's choice (docs/12); until then only the fake below, for
 * development and tests, which writes from the facts without a model.
 */
export interface ContentDraftProvider {
  name: string
  draft: (input: {
    kind: DraftKind
    prompt: string
    facts: ProductDraftFacts
    signal?: AbortSignal
  }) => Promise<string>
}

const sentence = (facts: ProductDraftFacts) =>
  [facts.brand, facts.name].filter(Boolean).join(" ") +
  (facts.attributes.length
    ? `, ${facts.attributes.map((each) => `${each.label.toLocaleLowerCase("tr")} ${each.value}`).join(", ")}`
    : "")

/** Writes from the facts alone, the same every time: no model, nothing leaves. */
export const fakeDraftProvider: ContentDraftProvider = {
  name: "fake",
  draft: ({ kind, facts }) => {
    if (kind === "seo_title") {
      const named = [facts.name, facts.brand, facts.category].filter(Boolean).join(" ")
      return Promise.resolve(`${named} | ${facts.shopName}`.slice(0, 60).trim())
    }
    if (kind === "seo_description") {
      return Promise.resolve(
        `${sentence(facts)}. ${facts.shopName} güvencesiyle hemen sipariş verin.`.slice(0, 155)
      )
    }
    const paragraph = `${sentence(facts)}. Günlük kullanıma uygun, dayanıklı ve bakımı kolay bir üründür. ${facts.category ? `${facts.category} kategorisinde öne çıkar. ` : ""}`
    return Promise.resolve(Array.from({ length: 12 }, () => paragraph).join("\n\n"))
  },
}

/** The provider set for the instance (`CONTENT_DRAFT_PROVIDER`); null while none is. */
export function contentDraftProvider(): ContentDraftProvider | null {
  return parseEnv().CONTENT_DRAFT_PROVIDER === "fake" ? fakeDraftProvider : null
}
