import { tenantNamespace } from ".."

describe("tenantNamespace", () => {
  it("names a tenant by its database server and name", () => {
    expect(tenantNamespace("postgres://u:p@db:6432/tenant_acme")).toBe("db:6432/tenant_acme")
    expect(tenantNamespace("postgres://localhost")).toBe("localhost:5432/default")
  })

  it("names a test run apart from dev on the same database", () => {
    expect(tenantNamespace("postgres://localhost/qticaret", "test")).toBe(
      "localhost:5432/qticaret/test"
    )
    expect(tenantNamespace("postgres://localhost/qticaret", "development", "a1b2c3d4")).toBe(
      "localhost:5432/qticaret"
    )
  })

  it("gives each integration test file keys of its own, so two runs at once never share a lock", () => {
    const one = tenantNamespace("postgres://localhost/qticaret", "test", "a1b2c3d4")
    const other = tenantNamespace("postgres://localhost/qticaret", "test", "e5f6a7b8")
    expect(one).toBe("localhost:5432/qticaret/test/a1b2c3d4")
    expect(other).not.toBe(one)
  })
})
