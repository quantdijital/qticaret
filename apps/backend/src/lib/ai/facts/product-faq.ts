import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { SUMMARY_TEXT_MAX, storedSummaryText } from "../../catalog/summary"
import { PRODUCT_QA_MODULE } from "../../../modules/product-qa"
import type ProductQaModuleService from "../../../modules/product-qa/service"
import { aiValidationError } from "../errors"
import { maskNames } from "../mask-names"
import { foldQuestion } from "../product-faq"
import type { FaqAllowed } from "../product-faq"
import { FAQ_PUBLISHED_QUESTIONS, FAQ_QUESTION_MAX_LENGTH } from "../registry/product-page-tasks"
import { SUMMARY_FIELD } from "./product-attributes"
import type { FactsContainer, RecordFacts } from "./types"

/**
 * What a FAQ draft reads beside the product's own facts (adr/0074 §5
 * madde 4; adr/0071 §10): its short description, and the questions already
 * published on its page, so none is asked again. Only a question's words
 * go, a customer's own name masked in them (lib/ai/mask-names.ts, as an
 * answer draft's); no name as a fact, no answer, customer, order or staff
 * field. Price and stock are not read.
 */

/** The data block's list of published questions: what the instruction names. */
export const PUBLISHED_QUESTIONS_FIELD = "published_questions"

/** Longest published question sent, in characters: a FAQ question's own room, and some. */
const PUBLISHED_QUESTION_LENGTH = FAQ_QUESTION_MAX_LENGTH * 2

export interface FaqFacts {
  fields: RecordFacts
  maxLengths: Readonly<Record<string, number>>
  maxItems: Readonly<Record<string, number>>
  allowed: FaqAllowed
}

interface QuestionRow {
  body: string
  author_name: string
  author_kind?: "customer" | "shop" | null
}

/** A published question as it may leave the shop: a customer's own name masked. */
export const publishedQuestionText = (row: QuestionRow): string =>
  row.author_kind === "shop" ? row.body : maskNames(row.body, [row.author_name])

/** The short description and the published questions, and the same questions folded as `allowed`. */
export async function productFaqFacts(
  container: FactsContainer,
  productId: string
): Promise<FaqFacts> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product",
    fields: ["id", "product_extension.summary_doc"],
    filters: { id: productId },
  })
  const row = data[0] as { product_extension?: { summary_doc?: unknown } | null } | undefined
  if (!row) {
    throw aiValidationError("ai.unknown_entity")
  }
  const questions = (await container
    .resolve<ProductQaModuleService>(PRODUCT_QA_MODULE)
    .listProductQuestions(
      { product_id: productId, status: "approved" },
      {
        take: FAQ_PUBLISHED_QUESTIONS,
        order: { created_at: "DESC" },
        select: ["id", "body", "author_name", "author_kind"],
      }
    )) as QuestionRow[]
  const summary = storedSummaryText(row.product_extension?.summary_doc)
  return {
    fields: {
      // Always a list, empty too: the instruction names it either way
      [PUBLISHED_QUESTIONS_FIELD]: questions.map((each, index) => ({
        label: `s${String(index + 1)}`,
        value: publishedQuestionText(each),
      })),
      [SUMMARY_FIELD]: summary === "" ? null : summary,
    },
    maxLengths: {
      [PUBLISHED_QUESTIONS_FIELD]: PUBLISHED_QUESTION_LENGTH,
      [SUMMARY_FIELD]: SUMMARY_TEXT_MAX,
    },
    maxItems: { [PUBLISHED_QUESTIONS_FIELD]: FAQ_PUBLISHED_QUESTIONS },
    allowed: {
      kind: "product_faq",
      published: questions.map((each) => foldQuestion(each.body)),
    },
  }
}
