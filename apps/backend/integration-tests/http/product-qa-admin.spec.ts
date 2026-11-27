import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createAdminUser } from "../helpers/admin"
import { registerCustomer } from "../helpers/customer"
import type { TestCustomer } from "../helpers/customer"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { stockShop, stockedProduct } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(180 * 1000)

interface StoreListed {
  questions: { id: string; body: string; answers: { body: string; by_shop: boolean }[] }[]
}

interface AdminListed {
  questions: {
    id: string
    body: string
    author_name: string
    status: string
    by_shop: boolean
    answers: { body: string; by_shop: boolean; status: string }[]
  }[]
  count: number
}

/** The shop manages a product's questions from the panel (owner 2026-11-27). */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let storefront: Storefront
    let admin: { headers: Record<string, string> }
    let asker: TestCustomer
    let productId: string

    const post = <T>(path: string, body: unknown, headers = admin.headers) =>
      settle(http.post<T & { message?: string }>(path, body, { headers }))
    const remove = (path: string) =>
      settle(http.delete<{ deleted?: boolean }>(path, { headers: admin.headers }))
    const storeListed = () =>
      http.get<StoreListed>(`/store/products/${productId}/questions`, {
        headers: storefront.headers,
      })
    const adminListed = () =>
      http.get<AdminListed>(`/admin/product-questions?product_id=${productId}`, {
        headers: admin.headers,
      })
    const addByHand = (question: string, answer: string) =>
      post<{ question?: { id: string } }>("/admin/product-questions", {
        product_id: productId,
        question,
        answer,
      })

    beforeEach(async () => {
      const container = getContainer()
      await loadTrAddressFixture(container)
      const shop = await stockShop(container)
      storefront = await createStorefront(container)
      admin = await createAdminUser(http, container)
      asker = await registerCustomer(http, storefront)
      ;({ productId } = await stockedProduct(
        container,
        shop,
        `bicak-${String(Date.now())}`,
        5,
        900
      ))
    })

    it("adds a question by hand, published at once, and lists every state on the product", async () => {
      const added = await addByHand("Garanti var mı?", "İki yıl garantilidir.")
      const asked = await post<{ question?: { id: string } }>(
        `/store/products/${productId}/questions`,
        { body: "Bu bıçak bulaşık makinesine girer mi?" },
        asker.headers
      )
      const store = await storeListed()
      const listed = await adminListed()

      expect(added.status).toBe(201)
      expect(store.data.questions).toEqual([
        expect.objectContaining({
          body: "Garanti var mı?",
          answers: [expect.objectContaining({ body: "İki yıl garantilidir.", by_shop: true })],
        }),
      ])
      // Newest first, the customer's waiting one too
      expect(listed.data.questions.map((row) => [row.id, row.status])).toEqual([
        [asked.data.question?.id, "pending"],
        [added.data.question?.id, "approved"],
      ])
    })

    it("edits a waiting question's words and answers it, which publishes it; removes the answer", async () => {
      const asked = await post<{ question?: { id: string } }>(
        `/store/products/${productId}/questions`,
        { body: "Bu bıçak bulaşık makinesine girer mi?" },
        asker.headers
      )
      const id = asked.data.question?.id ?? ""
      const answered = await post(`/admin/product-questions/${id}/edit`, {
        body: "Bulaşık makinesine girer mi?",
        answer: "Önermiyoruz; elde yıkayın.",
      })
      const shown = await storeListed()
      const cleared = await post(`/admin/product-questions/${id}/edit`, { answer: null })
      const after = await storeListed()
      const empty = await post(`/admin/product-questions/${id}/edit`, {})
      const unknown = await post("/admin/product-questions/pq_01UNKNOWN/edit", { body: "Ne?" })

      expect(answered.status).toBe(200)
      expect(shown.data.questions[0]).toMatchObject({
        body: "Bulaşık makinesine girer mi?",
        answers: [{ body: "Önermiyoruz; elde yıkayın.", by_shop: true }],
      })
      expect(cleared.status).toBe(200)
      expect(after.data.questions[0]?.answers).toEqual([])
      expect(empty.status).toBe(400)
      expect(unknown.status).toBe(404)
    })

    it("hides, deletes and brings back a question; the storefront follows at once", async () => {
      const added = await addByHand("Kılıf dahil mi?", "Evet, deri kılıfla gelir.")
      const id = added.data.question?.id ?? ""
      await post("/admin/product-questions/moderate", { ids: [id], status: "rejected" })
      const hidden = await storeListed()
      await post("/admin/product-questions/moderate", { ids: [id], status: "approved" })
      const deleted = await remove(`/admin/product-questions/${id}`)
      const gone = await storeListed()
      const goneInPanel = await adminListed()
      const restored = await post(`/admin/product-questions/${id}/restore`, {})
      const back = await storeListed()
      const again = await post(`/admin/product-questions/${id}/restore`, {})

      expect(hidden.data.questions).toEqual([])
      expect(deleted.status).toBe(200)
      expect(gone.data.questions).toEqual([])
      expect(goneInPanel.data.count).toBe(0)
      expect(restored.status).toBe(200)
      expect(back.data.questions[0]).toMatchObject({
        body: "Kılıf dahil mi?",
        answers: [{ body: "Evet, deri kılıfla gelir." }],
      })
      expect(again.status).toBe(404)
    })

    // Security review 2026-11-27 (HIGH): a deleted question must not bring an erased name back
    it("erases a customer's deleted question too, so Geri al never shows their name", async () => {
      const asked = await post<{ question?: { id: string } }>(
        `/store/products/${productId}/questions`,
        { body: "Sapı ahşap mı, kaplama mı?" },
        asker.headers
      )
      const id = asked.data.question?.id ?? ""
      const before = await adminListed()
      const realName = before.data.questions.find((row) => row.id === id)
      await remove(`/admin/product-questions/${id}`)
      const erasure = await post<{ privacy_request: { id: string } }>(
        `/admin/customers/${asker.id}/privacy-requests`,
        { kind: "erasure", channel: "letter", received_at: new Date().toISOString() }
      )
      const erased = await post(
        `/admin/privacy-requests/${erasure.data.privacy_request.id}/erase`,
        {}
      )
      const restored = await post(`/admin/product-questions/${id}/restore`, {})
      const after = await http.get<{ questions: { id: string; author_name: string }[] }>(
        `/admin/product-questions?product_id=${productId}`,
        { headers: admin.headers }
      )

      expect(realName?.author_name).toBeTruthy()
      expect(realName?.author_name).not.toBe("Anonim")
      expect(erased.status).toBe(200)
      expect(restored.status).toBe(200)
      expect(after.data.questions.find((row) => row.id === id)?.author_name).toBe("Anonim")
    })

    it("checks what is added by hand", async () => {
      const short = await addByHand("?", "Evet.")
      const unknown = await post("/admin/product-questions", {
        product_id: "prod_01UNKNOWN",
        question: "Garanti var mı?",
        answer: "Evet.",
      })
      const customer = await post(
        "/admin/product-questions",
        { product_id: productId, question: "Garanti var mı?", answer: "Evet." },
        asker.headers
      )

      expect(short.status).toBe(400)
      expect(unknown.status).toBe(404)
      expect([401, 403]).toContain(customer.status)
    })
  },
})
