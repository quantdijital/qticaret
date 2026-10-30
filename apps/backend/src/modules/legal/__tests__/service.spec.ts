import { randomBytes } from "node:crypto"
import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { LEGAL_MODULE } from ".."
import type LegalModuleService from "../service"

jest.setTimeout(60 * 1000)

const body = { type: "doc", content: [] }

moduleIntegrationTestRunner<LegalModuleService>({
  moduleName: LEGAL_MODULE,
  resolve: "./src/modules/legal",
  moduleOptions: {
    encryptionKey: randomBytes(32).toString("hex"),
    hashKey: randomBytes(32).toString("hex"),
  },
  testSuite: ({ service }) => {
    it("keeps one draft and one published version per kind, numbered in order", async () => {
      await service.createLegalDocuments({
        kind: "return_policy",
        version: 1,
        status: "published",
        title: "İade",
        body,
      })
      await service.createLegalDocuments({
        kind: "return_policy",
        version: 2,
        status: "draft",
        title: "İade",
        body,
      })

      const secondDraft = service.createLegalDocuments({
        kind: "return_policy",
        version: 3,
        status: "draft",
        title: "İade",
        body,
      })
      const secondPublished = service.createLegalDocuments({
        kind: "return_policy",
        version: 4,
        status: "published",
        title: "İade",
        body,
      })

      await expect(secondDraft).rejects.toThrow()
      await expect(secondPublished).rejects.toThrow()
      expect(await service.nextVersion("return_policy")).toBe(3)
      expect(await service.nextVersion("cookie_policy")).toBe(1)
      expect((await service.versionOf("return_policy", "published"))?.version).toBe(1)
      expect((await service.versionOf("return_policy", "draft"))?.version).toBe(2)
    })

    it("keeps the cart's last consent with its IP encrypted, and an order's copy once", async () => {
      const accepted = { kind: "distance_sales", version: 1, document_id: "ldoc_1", body_hash: "a" }
      await service.recordConsent("cart_1", [accepted], service.sealIp("cart_1", "203.0.113.7"))
      const again = await service.recordConsent(
        "cart_1",
        [{ ...accepted, version: 2 }],
        service.sealIp("cart_1", "203.0.113.8")
      )
      const [stored] = await service.listLegalConsents({ cart_id: "cart_1" })
      const copy = {
        order_id: "order_1",
        kind: "distance_sales" as const,
        version: 2,
        document_id: "ldoc_2",
        title: "Mesafeli satış sözleşmesi",
        html: "<p>Alıcı: Ayşe Yılmaz</p>",
      }
      const first = await service.keepOrderCopy(copy)
      const second = await service.keepOrderCopy({ ...copy, html: "<p>başka</p>" })
      const [row] = await service.listLegalOrderCopies({ order_id: "order_1" })

      expect(again.id).toBe(stored?.id)
      expect(stored?.documents).toEqual([{ ...accepted, version: 2 }])
      expect(stored?.ip_encrypted).not.toContain("203.0.113")
      expect(stored ? service.ipOf(stored) : null).toBe("203.0.113.8")
      expect(first.created).toBe(true)
      expect(second).toEqual({ id: first.id, created: false })
      expect(row?.html_encrypted).not.toContain("Ayşe")
      expect(await service.readOrderCopy("order_1", "distance_sales")).toMatchObject({
        version: 2,
        html: copy.html,
        intact: true,
      })
      expect(await service.readOrderCopy("order_1", "pre_information")).toBeNull()
    })

    it("reads an unreadable copy or IP as not intact or unknown, never as an error", async () => {
      const { id } = await service.keepOrderCopy({
        order_id: "order_2",
        kind: "distance_sales",
        version: 1,
        document_id: "ldoc_1",
        title: "Mesafeli satış sözleşmesi",
        html: "<p>Alıcı</p>",
      })
      // Sealed for another order: the key context does not match this one's
      await service.updateLegalOrderCopies({
        id,
        html_encrypted: service.sealIp("cart_9", "203.0.113.9") ?? "",
      })

      expect(await service.readOrderCopy("order_2", "distance_sales")).toMatchObject({
        html: "",
        intact: false,
      })
      expect(service.ipOf({ cart_id: "cart_1", ip_encrypted: "bozuk" })).toBeNull()
    })

    it("keeps every cookie banner answer by the visitor's hash, the latest in force", async () => {
      const first = await service.recordCookieConsent(service.visitorHash("visitor-a"), {
        analytics: true,
        marketing: true,
        policy_version: 1,
      })
      await service.recordCookieConsent(service.visitorHash("visitor-b"), {
        analytics: false,
        marketing: false,
        policy_version: 1,
      })
      // A withdrawal: a new answer, the first kept as it was
      await new Promise((resolve) => setTimeout(resolve, 5))
      await service.recordCookieConsent(service.visitorHash("visitor-a"), {
        analytics: true,
        marketing: false,
        policy_version: 1,
      })
      const rows = await service.listCookieConsents({})

      expect(rows).toHaveLength(3)
      expect(rows.map((row) => row.visitor_hash).join()).not.toContain("visitor-a")
      expect(await service.latestCookieConsent("visitor-a")).toMatchObject({ marketing: false })
      expect(await service.currentCookieConsent(first.id)).toMatchObject({ marketing: false })
      expect(await service.latestCookieConsent("visitor-c")).toBeNull()
    })
  },
})
