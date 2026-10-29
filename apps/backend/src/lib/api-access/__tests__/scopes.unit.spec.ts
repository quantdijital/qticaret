import { scopeOf } from "../scopes"

describe("API key scopes", () => {
  it.each([
    ["GET", "/admin/orders", "orders:read"],
    ["GET", "/admin/orders/order_01J", "orders:read"],
    ["GET", "/admin/products/prod_1", "catalog:read"],
    ["POST", "/admin/inventory-items/iitem_1/location-levels/sloc_1", "stock:write"],
    ["POST", "/admin/inventory-items/location-levels/batch", "stock:write"],
    ["DELETE", "/admin/webhooks/whk_1", "webhooks:manage"],
  ] as const)("%s %s needs %s", (method, path, scope) => {
    expect(scopeOf(method, path)).toBe(scope)
  })

  it.each([
    ["POST", "/admin/orders/order_1"],
    ["GET", "/admin/api-keys"],
    ["GET", "/admin/users"],
    ["GET", "/admin/orders/order_1/extra"],
    ["DELETE", "/admin/products/prod_1"],
    ["GET", "/admin/ordersx"],
  ] as const)("%s %s is closed to keys", (method, path) => {
    expect(scopeOf(method, path)).toBeNull()
  })
})
