import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { birfaturaClient, gibNumber } from "../helpers/birfatura"
import { birfaturaShop } from "../helpers/birfatura-shop"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"

jest.setTimeout(240 * 1000)

/** The BirFatura pull's security review (adr/0072): its findings, each held to. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    const birfatura = birfaturaClient(http)
    const bf = birfaturaShop(http, getContainer)
    bf.hooks()

    it("lets no flood without the token use up the shop's budget (S1)", async () => {
      await bf.settings("birfatura")
      const token = await bf.makeToken()
      const strangers = []
      // Past the shop's 120 a minute, none of them with the token
      for (let i = 0; i < 130; i += 1) {
        strangers.push((await birfatura.call("orderStatus", {})).status)
      }

      const birfaturaItself = await birfatura.call("orderStatus", {}, token)

      expect(new Set(strangers)).toEqual(new Set([401]))
      expect(birfaturaItself.status).toBe(200)
    })

    it("keeps the PDF it has when a report comes again with another link (S2)", async () => {
      await bf.settings("birfatura")
      const token = await bf.makeToken()
      const order = await bf.order()
      const number = gibNumber("ABC", 73_001)
      const link = (name: string) => bf.state.files.link(name)

      const first = await birfatura.link(token, {
        orderId: order.number,
        faturaUrl: link("ilk"),
        faturaNo: number,
      })
      const kept = (await bf.invoiceOf(order.id))?.pdf_file_id
      const replay = await birfatura.link(token, {
        orderId: order.number,
        faturaUrl: link("baska"),
        faturaNo: number,
      })
      const after = await bf.invoiceOf(order.id)

      expect(first.data).toMatchObject({ Success: true })
      expect(kept).toBeTruthy()
      expect(replay.data).toMatchObject({ Success: true })
      expect(after?.pdf_file_id).toBe(kept)
    })

    it("flags a canceled order BirFatura was handed, never cancels it unseen (S3)", async () => {
      await bf.settings("birfatura")
      const token = await bf.makeToken()
      const listed = await bf.order()
      await birfatura.pull(token)
      const unlisted = await bf.order()

      const fromListed = await bf.einvoice().requestCancel(listed.id)
      const fromUnlisted = await bf.einvoice().requestCancel(unlisted.id)
      const again = await birfatura.pull(token)
      const flagged = await bf.invoiceOf(listed.id)
      const withdrawn = await bf.invoiceOf(unlisted.id)

      expect(flagged?.listed_at).toBeTruthy()
      expect(flagged).toMatchObject({
        status: "pending",
        last_error: "einvoice.return_document_needed",
      })
      expect(flagged?.cancel_requested_at).toBeTruthy()
      expect(fromListed.needs_document).toEqual([flagged?.id])
      expect(withdrawn?.status).toBe("cancelled")
      expect(fromUnlisted.withdrawn).toEqual([withdrawn?.id])
      // Neither goes to BirFatura again
      expect(again.data.Orders.map((order) => order.OrderId)).not.toContain(listed.number)
      expect(again.data.Orders.map((order) => order.OrderId)).not.toContain(unlisted.number)
    })

    it("drops the token when BirFatura stops being the program: back again, a new one is needed", async () => {
      await bf.settings("birfatura")
      const token = await bf.makeToken()
      await bf.settings("external")
      await bf.settings("birfatura")

      const old = await birfatura.pull(token)
      const view = await http.get<{ birfatura: { token: unknown } }>("/admin/einvoice/birfatura", {
        headers: bf.state.owner.headers,
      })
      const fresh = await bf.makeToken()

      // No token stored: the door is shut as if never chosen
      expect(old.status).toBe(404)
      expect(view.data.birfatura.token).toBeNull()
      expect((await birfatura.pull(fresh)).status).toBe(200)
    })

    it.each([
      ["upper case", "/HOOKS/BIRFATURA/API/ORDERS"],
      ["a trailing slash", "/hooks/birfatura/api/orders/"],
    ])("guards %s the same: 401 without the token", async (_name, path) => {
      await bf.settings("birfatura")
      await bf.makeToken()

      const answer = await settle(
        http.post(path, {
          orderStatusId: 1,
          startDateTime: "01.11.2026 00:00:00",
          endDateTime: "02.11.2026 00:00:00",
        })
      )

      expect(answer.status).toBe(401)
    })
  },
})
