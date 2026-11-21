import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
  transform,
} from "@medusajs/framework/workflows-sdk"
import { aiValidationError } from "../../lib/ai/errors"
import { faqItemOf, foldQuestion } from "../../lib/ai/product-faq"
import type { FaqItem } from "../../lib/ai/product-faq"
import { PRODUCT_FAQ_TASK } from "../../lib/ai/registry/product-page-tasks"
import { ValidationError } from "../../lib/errors"
import { CONTENT_DRAFTS_MODULE } from "../../modules/content-drafts"
import type ContentDraftsModuleService from "../../modules/content-drafts/service"
import { PRODUCT_QA_MODULE } from "../../modules/product-qa"
import type ProductQaModuleService from "../../modules/product-qa/service"
import { brandOf } from "../messaging/brand"
import { authorizeDecision } from "./decide-suggestion"
import { AI_SUGGESTION_SOURCE } from "./steps/save-suggestion"

type Container = Pick<MedusaContainer, "resolve">

export interface AcceptFaqInput {
  /** The FAQ draft's suggestion. */
  id: string
  /** The items a person kept, as they edited them: gated again here, never taken as they come. */
  items: { q: string; a: string }[]
  user_id: string
}

interface Claimed {
  draft_id: string
  product_id: string
  items: FaqItem[]
}

/**
 * The items as stored: each through the same check an answer's item went
 * through (lib/ai/product-faq.ts), so an edit cannot add a link, markup,
 * personal data or a price; one that fails refuses the request, naming
 * which (`items.<n>`). A question kept twice is added once.
 */
export function keptFaqItems(items: readonly { q: string; a: string }[]): FaqItem[] {
  const seen = new Set<string>()
  const kept: FaqItem[] = []
  for (const [index, raw] of items.entries()) {
    const read = faqItemOf(raw)
    if ("problems" in read) {
      throw new ValidationError("ai.faq_item_invalid", { field: `items.${String(index)}` })
    }
    const key = foldQuestion(read.item.question)
    if (!seen.has(key)) {
      seen.add(key)
      kept.push(read.item)
    }
  }
  return kept
}

// The product's published questions read to hold a kept item against, at most
const PUBLISHED_READ = 1_000

/**
 * The items no published question of the product already asks (folded as
 * a FAQ answer's are held, `foldQuestion`): a repeat drops; none left is
 * 400 `ai.faq_all_published`, nothing added.
 */
export function unpublishedFaqItems(
  items: readonly FaqItem[],
  published: readonly string[]
): FaqItem[] {
  const asked = new Set(published.map(foldQuestion))
  const fresh = items.filter((item) => !asked.has(foldQuestion(item.question)))
  if (fresh.length === 0) {
    throw aiValidationError("ai.faq_all_published")
  }
  return fresh
}

/**
 * The decision on a FAQ draft (adr/0074 §5 madde 4), before anything is
 * written: only one of the core's own, still open, a product's FAQ, by a
 * role the task allows; the items gated; then accepted in one statement
 * (`decideOpen`: a second request at once is 400 `ai.suggestion_not_open`).
 */
async function claimFaq(container: Container, input: AcceptFaqInput): Promise<Claimed> {
  const drafts = container.resolve<ContentDraftsModuleService>(CONTENT_DRAFTS_MODULE)
  const [draft] = await drafts.listContentDrafts(
    { id: input.id, source: AI_SUGGESTION_SOURCE },
    { take: 1, select: ["id", "status", "kind", "entity_type", "entity_id"] }
  )
  if (draft?.status !== "draft") {
    throw aiValidationError("ai.suggestion_not_open")
  }
  await authorizeDecision(container, draft.kind, input.user_id)
  if (draft.kind !== PRODUCT_FAQ_TASK.id || draft.entity_type !== "product") {
    throw aiValidationError("ai.faq_not_product_faq")
  }
  const items = keptFaqItems(input.items)
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product",
    fields: ["id"],
    filters: { id: draft.entity_id },
  })
  if (data.length === 0) {
    throw aiValidationError("ai.unknown_entity")
  }
  // Read on the server, never sent anywhere: one asked already on its page is not added twice
  const published = await container
    .resolve<ProductQaModuleService>(PRODUCT_QA_MODULE)
    .listProductQuestions(
      { product_id: draft.entity_id, status: "approved" },
      { take: PUBLISHED_READ, select: ["id", "body"] }
    )
  const fresh = unpublishedFaqItems(
    items,
    published.map((each) => each.body)
  )
  const decided = await drafts.decideOpen(draft.id, {
    status: "approved",
    decided_by: input.user_id,
    decided_at: new Date(),
    accepted_index: 0,
  })
  if (!decided) {
    throw aiValidationError("ai.suggestion_not_open")
  }
  return { draft_id: draft.id, product_id: draft.entity_id, items: fresh }
}

const claimFaqStep = createStep(
  "ai-claim-faq",
  async (input: AcceptFaqInput, { container }) => {
    const claimed = await claimFaq(container, input)
    return new StepResponse(claimed, claimed.draft_id)
  },
  // The questions were not added: the draft is open again, to decide another way
  async (id, { container }) => {
    if (id) {
      await container
        .resolve<ContentDraftsModuleService>(CONTENT_DRAFTS_MODULE)
        .updateContentDrafts({
          id,
          status: "draft",
          decided_by: null,
          decided_at: null,
          accepted_index: null,
        })
    }
  }
)

/**
 * The items as the shop's own questions on the product's page, each with
 * its answer, under the shop's name and published at once. Nothing is
 * moderated, notified or e-mailed: no customer asked them.
 */
const addFaqStep = createStep(
  "ai-add-faq",
  async (input: Claimed & { user_id: string }, { container }) => {
    const { shopName } = await brandOf(container)
    const added = await container
      .resolve<ProductQaModuleService>(PRODUCT_QA_MODULE)
      .addShopQuestions({
        product_id: input.product_id,
        user_id: input.user_id,
        author_name: shopName,
        items: input.items,
      })
    return new StepResponse(added, added)
  },
  async (added, { container }) => {
    if (added) {
      await container.resolve<ProductQaModuleService>(PRODUCT_QA_MODULE).removeShopQuestions(added)
    }
  }
)

/**
 * "Seçilenleri ekle" under a FAQ draft (adr/0074 §5 madde 4): the decision
 * recorded (accepted, for the acceptance rate), then the kept items added
 * as the shop's questions; a failure adding them opens the draft again.
 */
export const acceptFaqWorkflow = createWorkflow("ai-accept-faq", (input: AcceptFaqInput) => {
  const claimed = claimFaqStep(input)
  const added = addFaqStep(
    transform({ claimed, input }, ({ claimed, input }) => ({ ...claimed, user_id: input.user_id }))
  )
  return new WorkflowResponse(
    transform({ claimed, added }, ({ claimed, added }) => ({
      id: claimed.draft_id,
      task: PRODUCT_FAQ_TASK.id,
      status: "accepted" as const,
      product_id: claimed.product_id,
      question_ids: added.question_ids,
    }))
  )
})
