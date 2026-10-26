import { lockingModules, tenantNamespace } from ".."

describe("the locking module's config (adr/0020)", () => {
  const namespace = tenantNamespace("postgres://db.internal:5432/shop_a")

  it("keeps Medusa's in-memory locks without a Redis", () => {
    expect(lockingModules(undefined, namespace)).toEqual([])
  })

  it("locks in Redis, under the tenant's own keys, when there is one", () => {
    expect(lockingModules("redis://cache:6379", namespace)).toEqual([
      {
        resolve: "@medusajs/medusa/locking",
        options: {
          providers: [
            {
              resolve: "@medusajs/medusa/locking-redis",
              id: "locking-redis",
              is_default: true,
              options: {
                redisUrl: "redis://cache:6379",
                namespace: "qt:lock:db.internal:5432/shop_a:",
              },
            },
          ],
        },
      },
    ])
  })
})
