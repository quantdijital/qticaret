import { asValue } from "@medusajs/framework/awilix"
import { ContainerRegistrationKeys, createMedusaContainer } from "@medusajs/framework/utils"
import {
  AdminGetQuestions,
  AdminPostQuestionEdit,
  AdminPostShopQuestion,
} from "../../../api/admin/product-questions/validators"
import { PRODUCT_QA_MODULE } from "../../../modules/product-qa"
import {
  addShopQuestionWorkflow,
  editQuestionWorkflow,
  removeQuestionWorkflow,
  restoreQuestionWorkflow,
} from "../question-admin"

jest.mock("../../messaging/brand", () => ({
  brandOf: jest.fn().mockResolvedValue({ shopName: "Atölye Bıçak" }),
}))

const qa = {
  addShopQuestions: jest.fn(),
  removeShopQuestions: jest.fn(),
  editQuestion: jest.fn(),
  undoEdit: jest.fn(),
  removeQuestion: jest.fn(),
  restoreQuestion: jest.fn(),
}
const query = { graph: jest.fn() }

const container = () => {
  const made = createMedusaContainer()
  made.register(PRODUCT_QA_MODULE, asValue(qa))
  made.register(ContainerRegistrationKeys.QUERY, asValue(query))
  return made
}

const settle = <T>(run: Promise<{ result: T }>) =>
  run.then(
    ({ result }) => ({ result, error: null }),
    (error: unknown) => ({ result: null, error })
  )

beforeEach(() => {
  query.graph.mockResolvedValue({ data: [{ id: "prod_1" }] })
  qa.addShopQuestions.mockResolvedValue({ question_ids: ["pq_1"], answer_ids: ["pans_1"] })
  qa.editQuestion.mockResolvedValue({
    id: "pq_1",
    body: "Eski?",
    has_link: false,
    status: "approved",
    moderated_by: null,
    moderated_at: null,
    answer: null,
  })
  qa.removeQuestion.mockResolvedValue({ id: "pq_1", product_id: "prod_1" })
  qa.restoreQuestion.mockResolvedValue({ id: "pq_1", product_id: "prod_1" })
})
afterEach(() => {
  jest.clearAllMocks()
})

/** The shop manages a product's questions from the panel (owner 2026-11-27). */
describe("managing product questions", () => {
  it("adds one question with its answer in the shop's name", async () => {
    const { result, error } = await settle(
      addShopQuestionWorkflow(container()).run({
        input: {
          product_id: "prod_1",
          question: "Garanti var mı?",
          answer: "İki yıl.",
          user_id: "user_1",
        },
        throwOnError: true,
      })
    )

    expect(error).toBeNull()
    expect(result).toEqual({ id: "pq_1" })
    expect(qa.addShopQuestions).toHaveBeenCalledWith({
      product_id: "prod_1",
      user_id: "user_1",
      author_name: "Atölye Bıçak",
      items: [{ question: "Garanti var mı?", answer: "İki yıl." }],
    })
  })

  it("adds nothing to a product that is not there", async () => {
    query.graph.mockResolvedValue({ data: [] })

    const { error } = await settle(
      addShopQuestionWorkflow(container()).run({
        input: {
          product_id: "prod_x",
          question: "Garanti var mı?",
          answer: "Yok.",
          user_id: "user_1",
        },
        throwOnError: true,
      })
    )

    expect(error).toMatchObject({ type: "not_found", message: "products.unknown" })
    expect(qa.addShopQuestions).not.toHaveBeenCalled()
  })

  it("edits the words and the shop's answer with the shop's name for a new answer", async () => {
    const { result, error } = await settle(
      editQuestionWorkflow(container()).run({
        input: { id: "pq_1", body: "Yeni soru?", answer: null, user_id: "user_1" },
        throwOnError: true,
      })
    )

    expect(error).toBeNull()
    expect(result).toEqual({ id: "pq_1" })
    expect(qa.editQuestion).toHaveBeenCalledWith({
      id: "pq_1",
      body: "Yeni soru?",
      answer: null,
      user_id: "user_1",
      author_name: "Atölye Bıçak",
    })
    expect(qa.undoEdit).not.toHaveBeenCalled()
  })

  it("deletes a question and brings it back", async () => {
    const removed = await settle(
      removeQuestionWorkflow(container()).run({ input: { id: "pq_1" }, throwOnError: true })
    )
    const restored = await settle(
      restoreQuestionWorkflow(container()).run({ input: { id: "pq_1" }, throwOnError: true })
    )

    expect(removed.result).toEqual({ id: "pq_1", product_id: "prod_1" })
    expect(restored.result).toEqual({ id: "pq_1", product_id: "prod_1" })
    expect(qa.removeQuestion).toHaveBeenCalledWith("pq_1")
    expect(qa.restoreQuestion).toHaveBeenCalledWith("pq_1")
  })
})

describe("the panel's question requests", () => {
  it("lists a product's questions in every state unless one is named", () => {
    expect(AdminGetQuestions.parse({ product_id: "prod_01ABC" })).toEqual({
      product_id: "prod_01ABC",
      offset: 0,
    })
    expect(AdminGetQuestions.safeParse({ product_id: "x; drop" }).success).toBe(false)
  })

  it("takes the shop's question and answer as plain text", () => {
    expect(
      AdminPostShopQuestion.parse({
        product_id: "prod_1",
        question: "  Garanti var mı?\u0007 ",
        answer: "İki yıl.\nFatura ile.",
      })
    ).toEqual({
      product_id: "prod_1",
      question: "Garanti var mı?",
      answer: "İki yıl.\nFatura ile.",
    })
    expect(
      AdminPostShopQuestion.safeParse({ product_id: "prod_1", question: "?", answer: "Evet." })
        .success
    ).toBe(false)
    expect(
      AdminPostShopQuestion.safeParse({
        product_id: "prod_1",
        question: "Ne?",
        answer: "a".repeat(1001),
      }).success
    ).toBe(false)
  })

  it("edits the words, the answer, or removes the answer; never nothing", () => {
    expect(AdminPostQuestionEdit.parse({ answer: null })).toEqual({ answer: null })
    expect(AdminPostQuestionEdit.parse({ body: "Kaç cm?" })).toEqual({ body: "Kaç cm?" })
    expect(AdminPostQuestionEdit.safeParse({}).success).toBe(false)
    // Direction overrides and zero widths go: the text reads as it is stored
    expect(AdminPostQuestionEdit.parse({ body: "Kaç\u202e cm\u200b?" })).toEqual({
      body: "Kaç cm?",
    })
    expect(AdminPostQuestionEdit.safeParse({ body: "Kaç cm?", status: "approved" }).success).toBe(
      false
    )
  })
})
