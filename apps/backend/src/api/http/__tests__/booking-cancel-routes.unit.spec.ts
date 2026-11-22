import { requireUserActor } from "../actor"
import { refuseCaptureForCancelledDeparture } from "../booking-capture-guard"
import { BOOKING_CANCEL_ROUTES } from "../booking-cancel-routes"
import { refundLimit } from "../order-refund-routes"

const routeOf = (matcher: string, method?: string) =>
  BOOKING_CANCEL_ROUTES.find(
    (route) =>
      route.matcher === matcher &&
      (method === undefined
        ? !("methods" in route)
        : "methods" in route && (route.methods as string[]).includes(method))
  )

describe("dated orders' cancel routes (adr/0076 Ek D7a)", () => {
  it.each(["/admin/orders/:id/bookings/cancel", "/admin/booking-slots/:id/cancel"])(
    "gives %s's money back for a staff member only, within the refunds' budget (review D6)",
    (matcher) => {
      const middlewares: unknown[] = routeOf(matcher, "POST")?.middlewares ?? []
      expect(middlewares).toContain(requireUserActor)
      expect(middlewares).toContain(refundLimit)
      // The actor is known before the budget counts it
      expect(middlewares.indexOf(requireUserActor)).toBeLessThan(middlewares.indexOf(refundLimit))
    }
  )

  it("checks a capture for a cancelled departure on every method's route (review O3)", () => {
    expect(routeOf("/admin/payments/:id/capture")?.middlewares).toEqual([
      refuseCaptureForCancelledDeparture,
    ])
  })
})
