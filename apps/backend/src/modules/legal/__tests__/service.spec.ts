import { randomBytes } from "node:crypto"
import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { LEGAL_MODULE } from ".."
import type LegalModuleService from "../service"

jest.setTimeout(60 * 1000)

const body = { type: "doc", content: [] }

moduleIntegrationTestRunner<LegalModuleService>({
  moduleName: LEGAL_MODULE,
  resolve: "./src/modules/legal",
  moduleOptions: { encryptionKey: randomBytes(32).toString("hex") },
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
      await service.recordConsent("cart_1", [accepted], "203.0.113.7")
      const again = await service.recordConsent(
        "cart_1",
        [{ ...accepted, version: 2 }],
        "203.0.113.8"
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
  },
})
