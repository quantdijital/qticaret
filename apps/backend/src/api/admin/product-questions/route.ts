import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { PRODUCT_QA_MODULE } from "../../../modules/product-qa"
import type ProductQaModuleService from "../../../modules/product-qa/service"
import { addShopQuestionWorkflow } from "../../../workflows/customers/question-admin"
import type { AdminGetQuestionsType, AdminPostShopQuestionType } from "./validators"

const PAGE = 20
// The waiting queue is read whole, oldest first, up to this many
const QUEUE = 100
// A product's own questions, newest first, on its page
const PRODUCT_PAGE = 50

/**
 * GET /admin/product-questions (F10.10): questions by state with all their
 * answers. "Waiting" holds new questions and approved ones with an answer
 * to look at. With `product_id`, that product's questions in every state.
 */
export async function GET(
  req: AuthenticatedMedusaRequest<unknown, AdminGetQuestionsType>,
  res: MedusaResponse
): Promise<void> {
  const { product_id: productId, offset } = req.validatedQuery
  const status = req.validatedQuery.status ?? (productId ? undefined : "pending")
  const qa = req.scope.resolve<ProductQaModuleService>(PRODUCT_QA_MODULE)
  let questions
  let count
  if (productId) {
    // One product's questions, every state unless one is named: the product page's list
    ;[questions, count] = await qa.listAndCountProductQuestions(
      { product_id: productId, ...(status ? { status } : {}) },
      { skip: offset, take: PRODUCT_PAGE, order: { created_at: "DESC" } }
    )
  } else if (status === "pending") {
    const waiting = await qa.listProductAnswers(
      { status: "pending" },
      { take: QUEUE, select: ["question_id"] }
    )
    questions = await qa.listProductQuestions(
      { $or: [{ status: "pending" }, { id: [...new Set(waiting.map((row) => row.question_id))] }] },
      { take: QUEUE, order: { created_at: "ASC" } }
    )
    count = questions.length
  } else {
    ;[questions, count] = await qa.listAndCountProductQuestions(status ? { status } : {}, {
      skip: offset,
      take: PAGE,
      order: { created_at: "DESC" },
    })
  }
  const ids = questions.map((question) => question.id)
  const [answers, { data }] = await Promise.all([
    ids.length > 0
      ? qa.listProductAnswers({ question_id: ids }, { order: { created_at: "ASC" } })
      : Promise.resolve([]),
    req.scope.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: "product",
      fields: ["id", "title"],
      filters: { id: [...new Set(questions.map((question) => question.product_id))] },
    }),
  ])
  const titles = new Map(
    (data as { id: string; title: string }[]).map((row) => [row.id, row.title])
  )
  res.json({
    questions: questions.map((question) => ({
      id: question.id,
      body: question.body,
      author_name: question.author_name,
      by_shop: question.author_kind === "shop",
      status: question.status,
      has_link: question.has_link,
      created_at: question.created_at,
      product: { id: question.product_id, title: titles.get(question.product_id) ?? null },
      answers: answers
        .filter((answer) => answer.question_id === question.id)
        .map((answer) => ({
          id: answer.id,
          body: answer.body,
          author_name: answer.author_name,
          by_shop: answer.author_kind === "shop",
          status: answer.status,
          has_link: answer.has_link,
          created_at: answer.created_at,
        })),
    })),
    count,
    limit: productId ? PRODUCT_PAGE : status === "pending" ? QUEUE : PAGE,
  })
}

/**
 * POST /admin/product-questions: the shop adds a question with its answer
 * to a product's Q&A by hand, in its own name and published at once.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostShopQuestionType>,
  res: MedusaResponse
): Promise<void> {
  const { product_id, question, answer } = req.validatedBody
  const { result } = await addShopQuestionWorkflow(req.scope).run({
    input: { product_id, question, answer, user_id: req.auth_context.actor_id },
  })
  res.status(201).json({ question: { id: result.id, status: "approved" } })
}
