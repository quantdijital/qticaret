import { createHash } from "node:crypto"
import type { MedusaContainer } from "@medusajs/framework/types"
import { PRODUCT_QA_MODULE } from "../../../../modules/product-qa"
import type ProductQaModuleService from "../../../../modules/product-qa/service"
import type { AuditedResource } from "../types"

/**
 * A product question edited, deleted or brought back from the panel
 * (owner 2026-11-27): its state, whether it is deleted, how long its words
 * are, a digest of them and of the shop's answer (a change to a customer's
 * words shows as a changed digest), who edited it last, before and after.
 * Not the words: a customer's question may hold their details.
 */
const digest = (text: string): string =>
  createHash("sha256").update(text).digest("hex").slice(0, 16)

const questionSnapshot = async ({
  scope,
  params,
}: {
  scope: unknown
  params: Record<string, string>
}) => {
  const qa = (scope as MedusaContainer).resolve<ProductQaModuleService>(PRODUCT_QA_MODULE)
  const id = params["id"] ?? ""
  const [question] = await qa.listProductQuestions(
    { id },
    {
      take: 1,
      withDeleted: true,
      select: ["status", "body", "author_kind", "deleted_at", "edited_by", "edited_at"],
    }
  )
  if (!question) {
    return {}
  }
  const shopAnswers = await qa.listProductAnswers(
    { question_id: id, author_kind: "shop" },
    { select: ["body"] }
  )
  return {
    status: question.status,
    by_shop: question.author_kind === "shop",
    deleted: question.deleted_at !== null,
    body_length: question.body.length,
    body_digest: digest(question.body),
    shop_answer_length: shopAnswers[0]?.body.length ?? 0,
    shop_answer_digest: shopAnswers[0] ? digest(shopAnswers[0].body) : null,
    edited_by: question.edited_by,
    edited_at: question.edited_at ? new Date(question.edited_at).toISOString() : null,
  }
}

const route = (method: "POST" | "DELETE", suffix: string, pattern: RegExp): AuditedResource => ({
  method,
  route: `${method} /admin/product-questions/:id${suffix}`,
  pattern,
  resourceType: "product_question",
  resourceId: (params) => params["id"] ?? null,
  snapshot: questionSnapshot,
})

export const PRODUCT_QUESTION_RESOURCES: readonly AuditedResource[] = [
  // Added by hand: the new question's id is in the answer, not the path; recorded as an action
  {
    method: "POST",
    route: "POST /admin/product-questions",
    pattern: /^\/admin\/product-questions$/i,
    resourceType: "product_question",
    resourceId: () => null,
    snapshot: () => Promise.resolve({}),
  },
  route("POST", "/edit", /^\/admin\/product-questions\/(?<id>pq_[A-Za-z0-9]+)\/edit$/i),
  route("DELETE", "", /^\/admin\/product-questions\/(?<id>pq_[A-Za-z0-9]+)$/i),
  route("POST", "/restore", /^\/admin\/product-questions\/(?<id>pq_[A-Za-z0-9]+)\/restore$/i),
]
