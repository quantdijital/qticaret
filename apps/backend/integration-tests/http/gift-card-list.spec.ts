import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { debitAccountsWorkflow } from "@medusajs/loyalty-plugin/workflows"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"

jest.setTimeout(240 * 1000)

interface ListedCard {
  id: string
  code: string
}

interface CardList {
  gift_cards: ListedCard[]
  count: number
  offset: number
  limit: number
  limited: boolean
}

/** The gift cards' paged list (adr/0025): by a code or its start, by state, a page at a time. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }

    const flag = (enabled: boolean) =>
      settle(
        http.post("/admin/features/promotions.gift_cards", { enabled }, { headers: admin.headers })
      )

    beforeEach(async () => {
      admin = await createAdminUser(http, getContainer())
      await flag(true)
    })

    // The flag lives in settings, whose cache outlives the database reset between tests
    afterEach(async () => {
      await flag(false)
    })

    const card = async (body: Record<string, unknown> = {}) =>
      (
        await http.post<{ gift_card: ListedCard }>(
          "/admin/gift-cards",
          { currency_code: "try", value: 100, ...body },
          { headers: admin.headers }
        )
      ).data.gift_card
    const list = (query = "") =>
      settle(http.get<CardList>(`/admin/gift-card-list?${query}`, { headers: admin.headers }))

    async function accountOf(cardId: string): Promise<string | null> {
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({
          entity: "gift_card",
          fields: ["store_credit_account.id"],
          filters: { id: cardId },
        })
      return (
        (data[0] as { store_credit_account?: { id: string } | null }).store_credit_account?.id ??
        null
      )
    }

    it("finds a card by its whole code or its start, newest first, a page at a time", async () => {
      const named = await card({ code: "hediye" })
      const others = []
      for (let index = 0; index < 25; index++) {
        others.push(await card())
      }

      const first = await list()
      expect(first.status).toBe(200)
      expect(first.data).toMatchObject({ count: 26, offset: 0, limit: 25, limited: false })
      expect(first.data.gift_cards[0]?.id).toBe(others.at(-1)?.id)
      expect((await list("offset=25")).data.gift_cards.map((each) => each.id)).toEqual([named.id])

      expect((await list("q=hediye")).data.gift_cards.map((each) => each.id)).toEqual([named.id])
      expect((await list(`q=${encodeURIComponent(named.code.toLowerCase())}`)).data.count).toBe(1)
      expect((await list("q=HEDIYE-ZZZZ")).data.count).toBe(0)
      expect((await list("q=%25")).data.count).toBe(0)
    })

    it("lists spendable, spent and expired cards apart", async () => {
      const spent = await card({ value: 50 })
      const kept = await card({ value: 80 })
      const accountId = await accountOf(spent.id)
      expect(accountId).not.toBeNull()
      await debitAccountsWorkflow(getContainer()).run({
        input: [{ account_id: accountId ?? "", amount: 50, reference: "test", reference_id: "t" }],
      })

      expect((await list("state=used")).data.gift_cards.map((each) => each.id)).toEqual([spent.id])
      expect((await list("state=active")).data.gift_cards.map((each) => each.id)).toEqual([kept.id])
      expect((await list("state=expired")).data.count).toBe(0)
      expect((await list("state=lost")).status).toBe(400)
    })

    it("answers as a route that does not exist while gift cards are off", async () => {
      await flag(false)
      expect((await list()).status).toBe(404)
    })
  },
})
