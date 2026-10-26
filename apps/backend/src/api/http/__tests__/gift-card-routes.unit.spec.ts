import type { MedusaRequest } from "@medusajs/framework/http"
import { RATE_LIMIT_PROFILES } from "../../../lib/security/rate-limit"
import { codeTry } from "../gift-card-routes"

const tryOf = (method: string, path: string) =>
  codeTry({ method, originalUrl: path, path: "/" } as unknown as MedusaRequest)

describe("gift card code tries (F4.8)", () => {
  it.each([
    ["GET", "/store/gift-cards/GIFT-ABCD"],
    // Express answers HEAD with the GET route
    ["HEAD", "/store/gift-cards/GIFT-ABCD"],
    ["POST", "/store/gift-cards/GIFT-ABCD/redeem"],
    ["POST", "/store/carts/cart_01/gift-cards"],
    ["DELETE", "/STORE/Carts/cart_01/gift-cards/"],
  ])("counts %s %s as a code try", (method, path) => {
    expect(tryOf(method, path)).toBe(RATE_LIMIT_PROFILES.coupon)
  })

  it.each([
    ["OPTIONS", "/store/gift-cards/GIFT-ABCD"],
    ["GET", "/store/carts/cart_01/gift-cards"],
    ["GET", "/store/gift-cards"],
    ["POST", "/store/carts/cart_01/store-credits"],
  ])("leaves %s %s to the routes' own limits", (method, path) => {
    expect(tryOf(method, path)).toBeNull()
  })
})
