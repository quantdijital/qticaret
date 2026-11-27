import type { Context } from "@medusajs/framework/types"
import { editQuestion_, undoEdit_ } from "../editing"
import ProductQaModuleService from "../service"

const QUESTION = {
  id: "pq_1",
  product_id: "prod_1",
  body: "Sapı ahşap mı?",
  has_link: false,
  status: "approved" as const,
  moderated_by: null,
  moderated_at: null,
  edited_by: null,
  edited_at: null,
}

const fakeService = () => ({
  retrieveProductQuestion: jest.fn().mockResolvedValue(QUESTION),
  updateProductQuestions: jest.fn(),
  listProductAnswers: jest.fn().mockResolvedValue([]),
  updateProductAnswers: jest.fn(),
  softDeleteProductAnswers: jest.fn(),
  restoreProductAnswers: jest.fn(),
  createProductAnswers: jest.fn().mockResolvedValue({ id: "pans_new" }),
  deleteProductAnswers: jest.fn(),
  recount_: jest.fn(),
})

const asService = (fake: ReturnType<typeof fakeService>) =>
  fake as unknown as ProductQaModuleService

/** The shop edits a question (owner 2026-11-27): who changed the words, and the undo. */
describe("editing a product question", () => {
  it("marks the words as the shop's edit and takes it back on undo", async () => {
    const service = fakeService()
    const undo = await editQuestion_(
      asService(service),
      {
        id: "pq_1",
        body: "Sapı ahşap mı? https://x.example",
        user_id: "user_1",
        author_name: "Mağaza",
      },
      {}
    )

    expect(service.updateProductQuestions).toHaveBeenCalledWith(
      {
        id: "pq_1",
        body: "Sapı ahşap mı? https://x.example",
        has_link: true,
        edited_by: "user_1",
        edited_at: expect.any(Date) as Date,
      },
      {}
    )
    await undoEdit_(asService(service), undo, {})
    expect(service.updateProductQuestions).toHaveBeenLastCalledWith(
      expect.objectContaining({
        id: "pq_1",
        body: "Sapı ahşap mı?",
        edited_by: null,
        edited_at: null,
      }),
      {}
    )
  })

  it("publishes a waiting question the shop answers, and leaves its words unmarked", async () => {
    const service = fakeService()
    service.retrieveProductQuestion.mockResolvedValue({ ...QUESTION, status: "pending" })
    await editQuestion_(
      asService(service),
      { id: "pq_1", answer: "Evet, ceviz.", user_id: "user_1", author_name: "Mağaza" },
      {}
    )

    expect(service.createProductAnswers).toHaveBeenCalledWith(
      expect.objectContaining({ author_kind: "shop", body: "Evet, ceviz.", status: "approved" }),
      {}
    )
    expect(service.updateProductQuestions).toHaveBeenCalledWith(
      expect.objectContaining({ id: "pq_1", status: "approved" }),
      {}
    )
    expect(service.updateProductQuestions).not.toHaveBeenCalledWith(
      expect.objectContaining({ edited_by: "user_1" }),
      {}
    )
  })
})

/** Security review 2026-11-27 (HIGH): erasure reaches deleted rows the generated update cannot. */
describe("erasing a question's author", () => {
  it("renames every question and answer of the customer, deleted ones included", async () => {
    const execute = jest.fn().mockResolvedValue([])
    const context = { transactionManager: { execute } } as unknown as Context
    const service = Object.create(ProductQaModuleService.prototype) as ProductQaModuleService

    await service.eraseAuthor({ customer_id: "cus_1", name: "Anonim" }, context)

    expect(execute.mock.calls).toEqual([
      [
        'update "product_question" set "author_name" = ? where "customer_id" = ?',
        ["Anonim", "cus_1"],
      ],
      [
        'update "product_answer" set "author_name" = ? where "customer_id" = ?',
        ["Anonim", "cus_1"],
      ],
    ])
    // No "deleted_at" condition: a deleted row is renamed as well
    const sql = (execute.mock.calls as [string, unknown[]][]).map(([text]) => text).join(";")
    expect(sql).not.toContain("deleted_at")
  })
})
