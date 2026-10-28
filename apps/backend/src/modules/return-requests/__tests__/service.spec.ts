import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { RETURN_REQUESTS_MODULE } from ".."
import type ReturnRequestsModuleService from "../service"

jest.setTimeout(120 * 1000)

moduleIntegrationTestRunner<ReturnRequestsModuleService>({
  moduleName: RETURN_REQUESTS_MODULE,
  resolve: "./src/modules/return-requests",
  testSuite: ({ service }) => {
    it("keeps one request being dealt with per order", async () => {
      const first = await service.createReturnRequests({
        order_id: "order_1",
        customer_id: "cus_1",
        reason: "damaged",
        items: [{ line_item_id: "ordli_1", quantity: 1 }] as unknown as Record<string, unknown>,
      })

      const second = service.createReturnRequests({
        order_id: "order_1",
        reason: "other",
        items: [] as unknown as Record<string, unknown>,
      })
      await expect(second).rejects.toThrow()
      await service.updateReturnRequests({ id: first.id, status: "rejected" })
      const after = await service.createReturnRequests({
        order_id: "order_1",
        reason: "other",
        items: [] as unknown as Record<string, unknown>,
      })

      expect(first).toMatchObject({ status: "requested", return_code: null })
      expect(after.status).toBe("requested")
    })
  },
})
