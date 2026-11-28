import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { AUDIT_LOG_MODULE } from "../../src/modules/audit-log"
import type AuditLogModuleService from "../../src/modules/audit-log/service"
import { MESSAGING_MODULE } from "../../src/modules/messaging"
import type MessagingModuleService from "../../src/modules/messaging/service"
import { birfaturaClient } from "../helpers/birfatura"
import { birfaturaShop } from "../helpers/birfatura-shop"
import { eventually } from "../helpers/eventually"
import type { HttpClient, HttpResponse } from "../helpers/http"
import { settle } from "../helpers/http"

jest.setTimeout(240 * 1000)

type Answer = HttpResponse<{ Success: boolean; Message: string }>

interface Parcel {
  id: string
  shipped_at: string | null
  canceled_at: string | null
  metadata: Record<string, unknown> | null
  labels: { tracking_number: string; tracking_url: string }[]
}

/**
 * "Kargoyu nereden yönetiyorsun?" BirFatura (adr/0072 Ek 2026-11-26): the
 * choice needs BirFatura connected, and while it holds BirFatura's tracking
 * number ships the order it pulled, once.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    const birfatura = birfaturaClient(http)
    const bf = birfaturaShop(http, getContainer)
    bf.hooks()

    const manage = (manager: string) =>
      settle(
        http.post<{ values: { manager: string } }>(
          "/admin/platform-settings/shipping",
          { manager },
          { headers: bf.state.owner.headers }
        )
      )
    const cargo = (token: string, body: Record<string, unknown>): Promise<Answer> =>
      birfatura.call("orderCargoUpdate", body, token)
    const parcelsOf = async (orderId: string): Promise<Parcel[]> => {
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({
          entity: "order",
          fields: [
            "fulfillments.id",
            "fulfillments.shipped_at",
            "fulfillments.canceled_at",
            "fulfillments.metadata",
            "fulfillments.labels.tracking_number",
            "fulfillments.labels.tracking_url",
          ],
          filters: { id: orderId },
        })
      return ((data[0] as { fulfillments?: Parcel[] } | undefined)?.fulfillments ?? []).filter(
        (parcel) => !parcel.canceled_at
      )
    }
    const shippedMails = (fulfillmentId: string) =>
      getContainer()
        .resolve<MessagingModuleService>(MESSAGING_MODULE)
        .listMessageSkips({ template: "order.shipped", resource_id: fulfillmentId })

    it("lets the shop pick BirFatura only while it is connected, and drops it with the program", async () => {
      await bf.settings("external")
      const whileExternal = await manage("birfatura")
      await bf.settings("birfatura")
      const noToken = await manage("birfatura")
      await bf.makeToken()
      const picked = await manage("birfatura")
      const again = await manage("birfatura")
      await bf.settings("external")
      const after = await http.get<{ values: { manager: string } }>(
        "/admin/platform-settings/shipping",
        { headers: bf.state.owner.headers }
      )

      expect(whileExternal.status).toBe(400)
      expect(JSON.stringify(whileExternal.data)).toMatch(/shipping\.birfatura_not_connected/)
      expect(noToken.status).toBe(400)
      expect(picked.status).toBe(200)
      expect(picked.data.values.manager).toBe("birfatura")
      expect(again.status).toBe(200)
      // BirFatura no longer the program: the shop's own way is back
      expect(after.data.values.manager).toBe("own")
    })

    it("sets the tracking aside while the shop ships with its own contracts", async () => {
      await bf.settings("birfatura")
      const token = await bf.makeToken()
      const order = await bf.order()
      await birfatura.pull(token)

      const answer = await cargo(token, {
        orderId: order.number,
        orderStatusId: 1,
        cargoTrackingCode: "AT27NN805",
      })

      expect(answer.status).toBe(200)
      expect(answer.data).toMatchObject({ Success: true, Message: "Kargo bilgisi alındı." })
      expect(await parcelsOf(order.id)).toEqual([])
    })

    it("ships the order BirFatura pulled once, with its tracking, and the customer told once", async () => {
      await bf.settings("birfatura")
      const token = await bf.makeToken()
      expect((await manage("birfatura")).status).toBe(200)
      const order = await bf.order()
      await birfatura.pull(token)
      // Queued after BirFatura's pull: never handed to it
      const notPulled = await bf.order()

      const body = {
        orderId: order.number,
        orderStatusId: 3,
        cargoTrackingCode: "AT27NN805",
        cargoTrackingCodeUrl: "https://kargotakip.example/AT27NN805",
        cargoCompany: "Aras",
        updateDateTime: "16.07.2026 14:27:09",
      }
      const first = await cargo(token, body)
      const replay = await cargo(token, body)
      const unknown = await cargo(token, { ...body, orderId: 987_654_321 })
      const unpulled = await cargo(token, { ...body, orderId: notPulled.number })
      const badNumber = await cargo(token, { ...body, cargoTrackingCode: "<b>1</b>" })
      const wrongToken = await cargo("11111111-2222-3333-4444-555555555555", body)
      const parcels = await parcelsOf(order.id)
      const mails = await eventually(
        () => shippedMails(parcels[0]?.id ?? ""),
        (rows) => rows.length > 0
      )
      // A moment more for a second e-mail that should never come
      await new Promise((resolve) => setTimeout(resolve, 500))
      const mailsAfter = await shippedMails(parcels[0]?.id ?? "")
      const entries = await getContainer()
        .resolve<AuditLogModuleService>(AUDIT_LOG_MODULE)
        .listAuditEntries({ action: "birfatura.cargo_updated" })

      expect(first.data).toMatchObject({ Success: true, Message: "Kargo bilgisi güncellendi." })
      expect(replay.data).toMatchObject({ Success: true })
      expect(parcels).toHaveLength(1)
      expect(parcels[0]?.shipped_at).toBeTruthy()
      expect(parcels[0]?.labels).toEqual([
        expect.objectContaining({
          tracking_number: "AT27NN805",
          tracking_url: "https://kargotakip.example/AT27NN805",
        }),
      ])
      expect(parcels[0]?.metadata).toMatchObject({ qt_carrier_name: "Aras" })
      expect(mails).toHaveLength(1)
      expect(mailsAfter).toHaveLength(1)
      expect(unknown.data).toMatchObject({ Success: false, Message: "Sipariş bulunamadı." })
      // Strictly an order BirFatura pulled from us: never one found by its number alone
      expect(unpulled.data).toMatchObject({ Success: false })
      expect(await parcelsOf(notPulled.id)).toEqual([])
      expect(badNumber.data).toMatchObject({ Success: false })
      expect(wrongToken.status).toBe(401)
      expect(entries.length).toBeGreaterThanOrEqual(5)
      // Ids only: never the tracking number, its link or the buyer
      expect(JSON.stringify(entries)).not.toContain("AT27NN805")
      expect(JSON.stringify(entries)).not.toContain("Ayşe")
    })
  },
})
