import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { ORDER_NOTES_MODULE } from ".."
import type OrderNotesModuleService from "../service"

jest.setTimeout(60 * 1000)

moduleIntegrationTestRunner<OrderNotesModuleService>({
  moduleName: ORDER_NOTES_MODULE,
  resolve: "./src/modules/order-notes",
  testSuite: ({ service }) => {
    it("keeps an order's notes, and a removed one with who removed it", async () => {
      const note = await service.createOrderNotes({
        order_id: "order_1",
        author_id: "user_1",
        body: "Müşteri aradı.",
      })
      await service.createOrderNotes({ order_id: "order_2", author_id: "user_1", body: "Başka" })

      expect(await service.listOrderNotes({ order_id: "order_1" })).toEqual([
        expect.objectContaining({ id: note.id, author_id: "user_1", removed_by: null }),
      ])

      await service.updateOrderNotes({ id: note.id, removed_by: "user_2" })
      await service.softDeleteOrderNotes([note.id])

      expect(await service.listOrderNotes({ order_id: "order_1" })).toEqual([])
      const [removed] = await service.listOrderNotes({ id: note.id }, { withDeleted: true })
      expect(removed).toMatchObject({ removed_by: "user_2" })
    })
  },
})
