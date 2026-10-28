import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { SHIPMENT_TRACKING_MODULE } from ".."
import type ShipmentTrackingModuleService from "../service"

jest.setTimeout(120 * 1000)

moduleIntegrationTestRunner<ShipmentTrackingModuleService>({
  moduleName: SHIPMENT_TRACKING_MODULE,
  resolve: "./src/modules/shipment-tracking",
  testSuite: ({ service }) => {
    it("tracks one parcel per fulfillment, each status reached once", async () => {
      const tracked = await service.createTrackedShipments({
        fulfillment_id: "ful_1",
        order_id: "order_1",
        provider: "geliver",
        provider_shipment_id: "shp_1",
      })
      await service.createShipmentEvents({
        shipment_id: tracked.id,
        status: "in_transit",
        occurred_at: new Date(),
      })

      const twiceStatus = service.createShipmentEvents({
        shipment_id: tracked.id,
        status: "in_transit",
        occurred_at: new Date(),
      })
      const twiceParcel = service.createTrackedShipments({
        fulfillment_id: "ful_1",
        order_id: "order_1",
        provider: "geliver",
        provider_shipment_id: "shp_2",
      })

      expect(tracked).toMatchObject({ status: "created", test: false, checked_at: null })
      await expect(twiceStatus).rejects.toThrow()
      await expect(twiceParcel).rejects.toThrow()
    })
  },
})
