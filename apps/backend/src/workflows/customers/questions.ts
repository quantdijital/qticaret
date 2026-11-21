import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { ValidationError } from "../../lib/errors"
import { qaPageJsonLd } from "../../lib/seo/qapage"
import { readsAsLink } from "../../lib/text/link-like"
import { PRODUCT_QA_MODULE } from "../../modules/product-qa"
import type ProductQaModuleService from "../../modules/product-qa/service"
import { URL_REGISTRY_MODULE } from "../../modules/url-registry"
import type UrlRegistryModuleService from "../../modules/url-registry/service"
import { CATALOG_ENTITY_TYPES, CATALOG_LOCALE } from "../catalog/entity-paths"
import { brandOf } from "../messaging/brand"
import { authorNameOf, deliveredOrderOf } from "./reviews"

type Container = Pick<MedusaContainer, "resolve">

/** A question's own storefront page, under its product's (F18 builds it). */
export const QUESTION_SEGMENT = "sorular"

const qaOf = (container: Container) => container.resolve<ProductQaModuleService>(PRODUCT_QA_MODULE)

async function customerName(container: Container, customerId: string): Promise<string> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "customer",
    fields: ["first_name", "last_name"],
    filters: { id: customerId },
  })
  const row = data[0] as { first_name: string | null; last_name: string | null } | undefined
  return authorNameOf(row ?? { first_name: null, last_name: null })
}

/** A signed-in customer's question about a published product; it waits for the shop. */
export async function askQuestion(
  container: Container,
  input: { customer_id: string; product_id: string; body: string }
): Promise<{ id: string }> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product",
    fields: ["id"],
    filters: { id: input.product_id, status: "published" },
  })
  if (data.length === 0) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "products.unknown")
  }
  const question = await qaOf(container).createProductQuestions({
    product_id: input.product_id,
    customer_id: input.customer_id,
    author_name: await customerName(container, input.customer_id),
    body: input.body,
    has_link: readsAsLink(input.body),
  })
  return { id: question.id }
}

/**
 * A customer's answer to an approved question: only from one who received
 * the product (KK6's sibling: no hearsay answers); it waits for the shop.
 */
export async function answerAsCustomer(
  container: Container,
  input: { customer_id: string; question_id: string; body: string }
): Promise<{ id: string }> {
  const qa = qaOf(container)
  const [question] = await qa.listProductQuestions(
    { id: input.question_id, status: "approved" },
    { take: 1, select: ["id", "product_id"] }
  )
  if (!question) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "questions.unknown")
  }
  if (!(await deliveredOrderOf(container, input.customer_id, question.product_id))) {
    throw new ValidationError("questions.answer_purchasers_only")
  }
  const answer = await qa.createProductAnswers({
    question_id: question.id,
    product_id: question.product_id,
    author_kind: "customer",
    customer_id: input.customer_id,
    user_id: null,
    author_name: await customerName(container, input.customer_id),
    body: input.body,
    has_link: readsAsLink(input.body),
  })
  return { id: answer.id }
}

interface AnswerRow {
  id: string
  question_id: string
  author_kind: "shop" | "customer"
  author_name: string
  body: string
  created_at: Date | string
}

const iso = (value: Date | string): string => new Date(value).toISOString()

/** Approved answers of the questions, the shop's first, then oldest first. */
async function approvedAnswers(container: Container, questionIds: string[]) {
  if (questionIds.length === 0) {
    return new Map<string, AnswerRow[]>()
  }
  const rows = (await qaOf(container).listProductAnswers(
    { question_id: questionIds, status: "approved" },
    { order: { created_at: "ASC" } }
  )) as AnswerRow[]
  const byQuestion = new Map<string, AnswerRow[]>()
  for (const row of rows.sort(
    (a, b) => Number(b.author_kind === "shop") - Number(a.author_kind === "shop")
  )) {
    byQuestion.set(row.question_id, [...(byQuestion.get(row.question_id) ?? []), row])
  }
  return byQuestion
}

const answerView = (row: AnswerRow) => ({
  id: row.id,
  body: row.body,
  author_name: row.author_kind === "shop" ? null : row.author_name,
  by_shop: row.author_kind === "shop",
  created_at: iso(row.created_at),
})

/** A product's approved questions with their approved answers, newest first (the product page). */
export async function productQuestions(
  container: Container,
  productId: string,
  page: { offset: number; limit: number }
) {
  const [rows, count] = await qaOf(container).listAndCountProductQuestions(
    { product_id: productId, status: "approved" },
    { skip: page.offset, take: page.limit, order: { created_at: "DESC" } }
  )
  const answers = await approvedAnswers(
    container,
    rows.map((row) => row.id)
  )
  return {
    questions: rows.map((row) => ({
      id: row.id,
      body: row.body,
      author_name: row.author_name,
      // The shop's own question (its FAQ, adr/0074 §5 madde 4), under the shop's name
      by_shop: row.author_kind === "shop",
      created_at: iso(row.created_at),
      answers: (answers.get(row.id) ?? []).map(answerView),
    })),
    count,
  }
}

/**
 * One approved question's own page (F10.10): the question, its answers,
 * its path under the product's, and the QAPage block when it has an
 * answer and the shop a domain. A product page never carries QAPage.
 */
export async function questionPage(container: Container, questionId: string) {
  const [question] = await qaOf(container).listProductQuestions(
    { id: questionId, status: "approved" },
    { take: 1 }
  )
  if (!question) {
    return null
  }
  const [answers, [entry], brand, { data }] = await Promise.all([
    approvedAnswers(container, [question.id]),
    container.resolve<UrlRegistryModuleService>(URL_REGISTRY_MODULE).listUrlEntries(
      {
        locale: CATALOG_LOCALE,
        entity_type: CATALOG_ENTITY_TYPES.product,
        entity_id: question.product_id,
        status: "active",
      },
      { take: 1, select: ["path"] }
    ),
    brandOf(container),
    container.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: "product",
      fields: ["id", "title", "handle"],
      filters: { id: question.product_id, status: "published" },
    }),
  ])
  const product = data[0] as { id: string; title: string; handle: string } | undefined
  if (!product) {
    return null
  }
  const rows = answers.get(question.id) ?? []
  const path = entry ? `${entry.path}/${QUESTION_SEGMENT}/${question.id}` : null
  // QAPage is for questions people asked (docs/13 §5); the shop's own FAQ carries none
  const asked = question.author_kind !== "shop"
  const jsonLd =
    asked && path && brand.storefrontUrl
      ? qaPageJsonLd(
          {
            question: {
              body: question.body,
              author: question.author_name,
              publishedAt: iso(question.created_at),
              answerCount: rows.length,
            },
            answers: rows.map((row) => ({
              id: row.id,
              body: row.body,
              author: row.author_name,
              publishedAt: iso(row.created_at),
              shop: row.author_kind === "shop",
            })),
            shopName: brand.shopName,
          },
          `${brand.storefrontUrl}${path}`
        )
      : null
  return {
    question: {
      id: question.id,
      body: question.body,
      author_name: question.author_name,
      by_shop: !asked,
      created_at: iso(question.created_at),
      answers: rows.map(answerView),
    },
    product: { id: product.id, title: product.title, handle: product.handle },
    path,
    json_ld: jsonLd,
  }
}
