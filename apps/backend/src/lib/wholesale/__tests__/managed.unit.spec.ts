import { readFileSync, readdirSync, statSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import {
  GUARDED_ROUTES,
  groupsInBody,
  groupsOfMemberships,
  groupsOfRules,
  readsOwned,
  touchesOwned,
} from "../managed"
import type { OwnedRecords } from "../managed"

const OWNED: OwnedRecords = {
  priceListIds: new Set(["plist_w"]),
  groupIds: new Set(["cusgroup_w"]),
}

describe("the guard on Medusa's own routes (ADR-0068 §9)", () => {
  it("refuses a write to the module's group or list, and lets reads through", () => {
    expect(touchesOwned("group", { method: "POST", id: "cusgroup_w", body: {} }, OWNED)).toBe(true)
    expect(touchesOwned("group", { method: "DELETE", id: "cusgroup_w", body: {} }, OWNED)).toBe(
      true
    )
    expect(touchesOwned("group", { method: "GET", id: "cusgroup_w", body: {} }, OWNED)).toBe(false)
    expect(touchesOwned("group", { method: "POST", id: "cusgroup_x", body: {} }, OWNED)).toBe(false)
    expect(touchesOwned("price_list", { method: "POST", id: "plist_w", body: {} }, OWNED)).toBe(
      true
    )
    expect(touchesOwned("price_list", { method: "post", id: "plist_x", body: {} }, OWNED)).toBe(
      false
    )
  })

  it("refuses another list given rules naming the module's group, new or changed", () => {
    const rules = { rules: { "customer.groups.id": ["cusgroup_a", "cusgroup_w"] } }
    expect(touchesOwned("rules", { method: "POST", id: undefined, body: rules }, OWNED)).toBe(true)
    expect(touchesOwned("price_list", { method: "POST", id: "plist_x", body: rules }, OWNED)).toBe(
      true
    )
    const other = { rules: { "customer.groups.id": ["cusgroup_a"] } }
    expect(touchesOwned("rules", { method: "POST", id: undefined, body: other }, OWNED)).toBe(false)
  })

  it("refuses a customer added to or taken from the module's group the other way round", () => {
    const add = { add: ["cusgroup_w"] }
    const remove = { remove: ["cusgroup_w"], add: ["cusgroup_a"] }
    expect(touchesOwned("memberships", { method: "POST", id: "cus_1", body: add }, OWNED)).toBe(
      true
    )
    expect(touchesOwned("memberships", { method: "POST", id: "cus_1", body: remove }, OWNED)).toBe(
      true
    )
    expect(
      touchesOwned("memberships", { method: "POST", id: "cus_1", body: { add: ["x"] } }, OWNED)
    ).toBe(false)
  })

  it("reads groups from rules and membership bodies, whatever their shape", () => {
    expect(groupsOfRules({ "customer.groups.id": "g1" })).toEqual(["g1"])
    expect(groupsOfRules({ "customer.groups.id": ["g1", 2, null] })).toEqual(["g1"])
    expect(groupsOfRules({ "customer.groups.id": { operator: "in", value: ["g1"] } })).toEqual([
      "g1",
    ])
    expect(groupsOfRules({ "customer.groups.id": [{ operator: "eq", value: "g2" }] })).toEqual([
      "g2",
    ])
    expect(groupsOfRules(null)).toEqual([])
    expect(groupsOfRules("x")).toEqual([])
    expect(groupsOfMemberships({ add: ["a"], remove: "b" })).toEqual(["a", "b"])
    expect(groupsOfMemberships(undefined)).toEqual([])
  })

  it("finds a rule naming the module's group on any price of a body (M2)", () => {
    const write = (body: unknown) => ({ method: "POST", id: "plist_x", body })
    const rule = { "customer.groups.id": "cusgroup_w" }
    for (const body of [
      // A new list's prices, a batch's created and changed prices
      { prices: [{ variant_id: "v", amount: 1, currency_code: "try", rules: rule }] },
      { create: [{ variant_id: "v", amount: 1, rules: rule }] },
      { update: [{ id: "price_1", amount: 1, rules: rule }] },
      // A product's variants' prices, one or a batch
      { variants: [{ title: "S", prices: [{ amount: 1, rules: rule }] }] },
      { update: [{ id: "v", prices: [{ amount: 1, rules: { ...rule, region_id: "reg" } }] }] },
    ]) {
      expect(touchesOwned("price_list", write(body), OWNED)).toBe(true)
      expect(touchesOwned("rules", write(body), OWNED)).toBe(true)
    }
    const regionOnly = { prices: [{ amount: 1, rules: { region_id: "reg_1" } }] }
    expect(touchesOwned("rules", write(regionOnly), OWNED)).toBe(false)
    expect(groupsInBody({ a: { b: { rules: rule } } })).toEqual(["cusgroup_w"])
  })

  it("answers a read of the module's group or list by id as missing, and no other read (M1)", () => {
    const read = (id: string) => ({ method: "GET", id, body: undefined })
    expect(readsOwned("group", read("cusgroup_w"), OWNED)).toBe(true)
    expect(readsOwned("price_list", read("plist_w"), OWNED)).toBe(true)
    expect(readsOwned("price_list", read("plist_x"), OWNED)).toBe(false)
    expect(readsOwned("group", read("plist_w"), OWNED)).toBe(false)
    expect(readsOwned("rules", read("plist_w"), OWNED)).toBe(false)
    expect(readsOwned("group", { ...read("cusgroup_w"), method: "POST" }, OWNED)).toBe(false)
  })
})

// Medusa's own admin routes, as the plan guard's test reads them
const CORE = join(dirname(require.resolve("@medusajs/medusa/package.json")), "dist/api/admin")
const CORE_HANDLER = /exports\.(POST|PUT|PATCH|DELETE)\s*=/g

function coreWrites(): string[] {
  const found: string[] = []
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name)
      if (statSync(path).isDirectory()) {
        walk(path)
      } else if (name === "route.js") {
        const route = `/admin/${relative(CORE, dir)}`.replace(/\[(\w+)\]/g, ":$1")
        for (const [, method = ""] of readFileSync(path, "utf8").matchAll(CORE_HANDLER)) {
          found.push(`${method} ${route}`)
        }
      }
    }
  }
  walk(CORE)
  return found.sort()
}

/** Express's reading of a matcher: `:name` one segment, `/*` anything below. */
const matcherPattern = (matcher: string) =>
  new RegExp(`^${matcher.replace(/\/\*$/, "/.+").replace(/:\w+/g, "[^/]+")}$`)

describe("every Medusa write route to groups, price lists or memberships is guarded", () => {
  const writes = coreWrites()
  const reachesGroupsOrLists = (route: string) =>
    /\/admin\/(customer-groups|price-lists)(\/|$)/.test(route) ||
    /\/customer-groups(\/|$)/.test(route)

  // Medusa 2.21.2's: a new route here is a new way round the module, to decide on
  it("finds them", () => {
    expect([...new Set(writes.filter(reachesGroupsOrLists))]).toEqual([
      "DELETE /admin/customer-groups/:id",
      "DELETE /admin/price-lists/:id",
      "POST /admin/customer-groups",
      "POST /admin/customer-groups/:id",
      "POST /admin/customer-groups/:id/customers",
      "POST /admin/customers/:id/customer-groups",
      "POST /admin/price-lists",
      "POST /admin/price-lists/:id",
      "POST /admin/price-lists/:id/prices/batch",
      "POST /admin/price-lists/:id/products",
    ])
  })

  it("covers each with a guard, by POST or DELETE", () => {
    const sample = (path: string) => path.replace(/:\w+/g, "x1")
    // A new group is empty and names nothing the module owns
    const NEW_GROUP = "POST /admin/customer-groups"
    const unguarded = writes.filter(reachesGroupsOrLists).filter((route) => {
      if (route === NEW_GROUP) {
        return false
      }
      const [method = "", path = ""] = route.split(" ")
      return (
        !["POST", "DELETE"].includes(method) ||
        !GUARDED_ROUTES.some(({ matcher }) => matcherPattern(matcher).test(sample(path)))
      )
    })
    expect(unguarded).toEqual([])
  })

  it("covers every product write, where a variant's price can carry a rule (M2)", () => {
    const sample = (path: string) => path.replace(/:\w+/g, "x1")
    const products = writes.filter((route) => / \/admin\/products(\/|$)/.test(route))
    expect(products.length).toBeGreaterThan(5)
    const unguarded = products.filter((route) => {
      const [method = "", path = ""] = route.split(" ")
      return (
        method === "POST" &&
        !GUARDED_ROUTES.some(
          ({ matcher, check }) => check === "rules" && matcherPattern(matcher).test(sample(path))
        )
      )
    })
    expect(unguarded).toEqual([])
  })
})
