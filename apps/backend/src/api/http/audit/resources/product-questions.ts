import type { MedusaContainer } from "@medusajs/framework/types"
import { PRODUCT_QA_MODULE } from "../../../../modules/product-qa"
import type ProductQaModuleService from "../../../../modules/product-qa/service"
import type { AuditedResource } from "../types"

/**
 * A product question edited, deleted or brought back from the panel
 * (owner 2026-11-27): its state, whether it is deleted, how long its words
 * are and whether the shop answered, before and after. Not the words: a
 * customer's question may hold their details, and the storefront shows it.
 */
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
    { take: 1, withDeleted: true, select: ["status", "body", "author_kind", "deleted_at"] }
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
    shop_answer_length: shopAnswers[0]?.body.length ?? 0,
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
  route("POST", "/edit", /^\/admin\/product-questions\/(?<id>pq_[A-Za-z0-9]+)\/edit$/i),
  route("DELETE", "", /^\/admin\/product-questions\/(?<id>pq_[A-Za-z0-9]+)$/i),
  route("POST", "/restore", /^\/admin\/product-questions\/(?<id>pq_[A-Za-z0-9]+)\/restore$/i),
]
